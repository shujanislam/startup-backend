import { Request, Response } from 'express'

import redis from '../config/redis'

import logger from '../config/logger'

import Package from '../models/Package' 

import PackageReview from '../models/PackageReviews'

import User from '../models/User'

import UserPackageReveal from '../models/UserPackageReveal'

import LikedPackage from '../models/LikedPackage'

import type { PopulateOptions } from 'mongoose'

import { createPackageSchema, validateSchema, updatePackageSchema, createReviewSchema, sortPackageSchema } from '../utils/validSchema'

import { checkAdminRole } from '../utils/roleCheck'

import { buildReviewEligibility } from '../utils/reviewEligibility'

const packagePopulateConfig: PopulateOptions[] = [
  { path: 'hotels', select: 'name phoneNumber address photos budget' },
  { path: 'vehicles', select: 'car carNumber driverName driverPhoneNumber vehicleType budget' },
]

const REVIEW_DELAY_DAYS = 3
const REVIEW_DELAY_MS = REVIEW_DELAY_DAYS * 24 * 60 * 60 * 1000

const REDIS_TTL = 3600

const getPackages = async (req: Request, res: Response) => {
  const REDIS_CACHE_KEY = 'packages:list:approved:true'
  try {
    const cached = await redis.get(REDIS_CACHE_KEY)

    if(cached) {
      logger.info('cache hit')
      return res.status(200).json(JSON.parse(cached))
    }

    const packages = await Package.find({ approved: true }).populate(packagePopulateConfig)

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(packages), 'EX', REDIS_TTL)

    logger.info('cache miss')
    return res.status(200).json(packages)
  } catch (error) {
    logger.error(`Error fetching package list: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch packages' })
  }
}

const viewPackage = async (req: Request, res: Response) => { 
  const packageId = req.params.id 

  try {
    const REDIS_CACHE_KEY = `package:${packageId}`

    const cached = await redis.get(REDIS_CACHE_KEY)

    if(cached){
      return res.status(200).json(JSON.parse(cached))
    }

    const packageData = await Package.findById(packageId).populate(packagePopulateConfig)

    if (!packageData) {
      return res.status(404).json({ message: 'Package not found' })
    }

    let isAdmin = false
    if (req.userId) {
      const roleCheck = await checkAdminRole(req.userId)
      if (!roleCheck.ok && roleCheck.status === 500) {
        logger.error(`Admin role check failed for user ${req.userId}: ${roleCheck.message}`)
      }
      isAdmin = roleCheck.ok
    }
    const canViewPackage = packageData.approved || packageData.createdBy === req.userId || isAdmin

    if (!canViewPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(packageData), 'EX', REDIS_TTL)

    return res.status(200).json(packageData)
  } catch (error) {
    logger.error(`Error fetching package ${packageId}: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch package' })
  }
}

const discoverPackage = async (req: Request, res: Response) => {
  logger.info('discoverPackage endpoint called')

  const validation = validateSchema(sortPackageSchema, req.query)

  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  const {
    search,
    destination,
    season,
    minBudget,
    maxBudget,
    minDuration,
    maxDuration,
    tags,
    sortBy,
    order,
    page,
    limit,
  } = validation.data

  try {
    const query: Record<string, unknown> = {
      approved: true,
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { destination: { $regex: search, $options: 'i' } },
      ]
    }

    if (destination) {
      query.destination = { $regex: destination, $options: 'i' }
    }

    if (season) {
      query.season = { $regex: season, $options: 'i' }
    }

    if (minBudget !== undefined || maxBudget !== undefined) {
      query.budget = {
        ...(minBudget !== undefined ? { $gte: minBudget } : {}),
        ...(maxBudget !== undefined ? { $lte: maxBudget } : {}),
      }
    }

    if (minDuration !== undefined || maxDuration !== undefined) {
      query.duration = {
        ...(minDuration !== undefined ? { $gte: minDuration } : {}),
        ...(maxDuration !== undefined ? { $lte: maxDuration } : {}),
      }
    }

    if (tags && tags.length > 0) {
      query.tags = { $in: tags }
    }

    const sortOrder = order === 'asc' ? 1 : -1
    const skip = (page - 1) * limit

    const [packages, total] = await Promise.all([
      Package.find(query)
        .populate(packagePopulateConfig)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      Package.countDocuments(query),
    ])

    return res.status(200).json({
      message: 'Packages fetched successfully',
      data: packages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error(`Error fetching packages: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch packages' })
  }
}

const postPackage = async (req: Request, res: Response) => {
  logger.info('postPackage endpoint called')

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const validation = validateSchema(createPackageSchema, req.body)

  if(!validation.success){
    return res.status(400).json({
      message: "Validation Failed",
      errors: validation.errors
    })
  }

  try{
    const createdPackage = await Package.create({
      ...validation.data,
      createdBy: req.userId,
    })

    const populatedPackage = await Package.findById(createdPackage._id).populate(packagePopulateConfig)

    return res.status(201).json({
      message: "Package created successfully",
      data: populatedPackage ?? createdPackage,
    })
  }catch(error){
    logger.error(`Error creating package: ${error}`)
    return res.status(500).json({ message: "Failed to create Package" })
  }
}

const updatePackage = async (req: Request, res: Response) => {
  const packageId = req.params.id
  logger.info(`updatePackage endpoint called for id: ${packageId || 'not provided'}`)

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

   // ✅ Add validation here!
  const validation = validateSchema(updatePackageSchema, req.body)
  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors
    })
  }

  if (Object.keys(validation.data).length === 0) {
    return res.status(400).json({ 
      message: 'No valid fields provided for update' 
    })
  }

  try {
    const existingPackage = await Package.findById(packageId)

    if (!existingPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const roleCheck = await checkAdminRole(req.userId)
    const isAdmin = roleCheck.ok

    if (!isAdmin && roleCheck.status === 500) {
      logger.error(`Admin role check failed for user ${req.userId}: ${roleCheck.message}`)
    }
    const isOwner = existingPackage.createdBy === req.userId

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you cannot update this package' })
    }

    const updateData = {
      ...validation.data,
      ...(!isAdmin && existingPackage.approved ? { approved: false } : {}),
    }

    const updatedPackage = await Package.findByIdAndUpdate(
      packageId,
      updateData,
      { new: true, runValidators: true }
    ).populate(packagePopulateConfig)

    if (!updatedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    return res.status(200).json({
      message:
        !isAdmin && existingPackage.approved
          ? 'Package updated successfully and requires re-approval'
          : 'Package updated successfully',
      data: updatedPackage,
    })
  } catch (error) {
    logger.error(`Error updating package: ${error}`)
    return res.status(500).json({ message: 'Failed to update package' })
  }
}

const postPackageReview = async (req: Request, res: Response) => {
  logger.info('postPackageReview endpoint called')

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  // ✅ Add validation here too!
  const validation = validateSchema(createReviewSchema, req.body)
  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors
    })
  }

  try {
    const { packageId, review, rating } = validation.data

    const packageExists = await Package.exists({ _id: packageId })
    if (!packageExists) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const revealRecord = await UserPackageReveal.findOne({
      packageId,
      userId: req.userId,
    })
      .select('createdAt')
      .lean()

    const eligibility = buildReviewEligibility(revealRecord)

    if (!eligibility.revealed) {
      return res.status(403).json({ message: 'Unlock the trip before posting a review' })
    }

    if (!eligibility.canReview) {
      return res.status(403).json({
        message: `Reviews unlock ${REVIEW_DELAY_DAYS} days after unlocking`,
        data: {
          reviewAvailableAt: eligibility.reviewAvailableAt?.toISOString() ?? null,
          daysRemaining: eligibility.daysRemaining,
        },
      })
    }

    const createdReview = await PackageReview.create({
      packageId,
      userId: req.userId,
      review,
      rating,
    })

    return res.status(201).json({
      message: 'Package review created successfully',
      data: createdReview,
    })
  } catch (error) {
    logger.error(`Error creating package review: ${error}`)
    return res.status(500).json({ message: 'Failed to create package review' })
  }
}

const getReviewEligibility = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const packageId = req.params.id

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  try {
    const packageExists = await Package.exists({ _id: packageId })

    if (!packageExists) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const revealRecord = await UserPackageReveal.findOne({
      packageId,
      userId: req.userId,
    })
      .select('createdAt')
      .lean()

    const eligibility = buildReviewEligibility(revealRecord)

    return res.status(200).json({
      message: 'Review eligibility fetched successfully',
      data: {
        revealed: eligibility.revealed,
        revealedAt: eligibility.revealedAt ? eligibility.revealedAt.toISOString() : null,
        canReview: eligibility.canReview,
        reviewAvailableAt: eligibility.reviewAvailableAt
          ? eligibility.reviewAvailableAt.toISOString()
          : null,
        daysRemaining: eligibility.daysRemaining,
        status: eligibility.status,
      },
    })
  } catch (error) {
    logger.error(`Error fetching review eligibility for package ${packageId}: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch review eligibility' })
  }
}

const getPackageReviews = async (req: Request, res: Response) => {
  const packageId = req.params.id

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  try {
    const REDIS_CACHE_KEY = `package:${packageId}:reviews`

    const cached = await redis.get(REDIS_CACHE_KEY)

    if (cached) {
      logger.info('cache hit')
      return res.status(200).json(JSON.parse(cached))
    }

    const packageExists = await Package.exists({ _id: packageId })
    if (!packageExists) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const reviews = await PackageReview.find({ packageId })
      .sort({ createdAt: -1 })
      .lean()

    const userIds = [...new Set(reviews.map((r) => r.userId).filter(Boolean))]
    const users = await User.find({ firebaseId: { $in: userIds } })
      .select('firebaseId name profilePicture')
      .lean()

    const userMap = new Map(users.map((u) => [u.firebaseId, u]))

    const enrichedReviews = reviews.map((r) => {
      const reviewer = userMap.get(r.userId)
      return {
        ...r,
        userName: reviewer?.name ?? 'Anonymous',
        userPicture: reviewer?.profilePicture ?? '',
      }
    })

    const response = {
      message: 'Reviews fetched successfully',
      data: enrichedReviews,
    }

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(response), 'EX', REDIS_TTL)

    logger.info('cache miss')
    return res.status(200).json(response)
  } catch (error) {
    logger.error(`Error fetching reviews for package ${packageId}: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch reviews' })
  }
}

const deletePackage = async (req: Request, res: Response) => {
  logger.info(`deletePackage endpoint called for id: ${req.params.id || 'not provided'}`)

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  
  const packageId = req.params.id

  try {
    const existingPackage = await Package.findById(packageId)
    
    if (!existingPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const roleCheck = await checkAdminRole(req.userId)
    const isAdmin = roleCheck.ok

    if (!isAdmin && roleCheck.status === 500) {
      logger.error(`Admin role check failed for user ${req.userId}: ${roleCheck.message}`)
    }
    const isOwner = existingPackage.createdBy === req.userId

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you cannot delete this package' })
    }

    if (existingPackage.approved && !isAdmin) {
      return res
        .status(403)
        .json({ message: 'Approved packages can only be deleted by an admin' })
    }

    const deletedPackage = await Package.findByIdAndDelete(packageId)

    if (!deletedPackage) {
      logger.info('Error while deleting the package')
      return res.status(404).json({ message: 'Package not found' })
    }

    logger.info('Successfully deleted the package')

    return res.status(200).json({ message: 'Package deleted successfully' })
  } catch (error) {
    logger.error(`Error deleting package: ${error}`)
    return res.status(500).json({ message: 'Failed to delete package' })
  }
}

const getPendingPackages = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const roleCheck = await checkAdminRole(req.userId)

    if (!roleCheck.ok) {
      return res.status(roleCheck.status).json({ message: roleCheck.message })
    }

    const packages = await Package.find({ approved: false })
      .populate(packagePopulateConfig)
      .sort({ createdAt: -1 })

    return res.status(200).json(packages)
  } catch (error) {
    logger.error(`Error fetching pending packages: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch pending packages' })
  }
}

const approvePackage = async(req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const roleCheck = await checkAdminRole(req.userId)

    if (!roleCheck.ok) {
      return res.status(roleCheck.status).json({ message: roleCheck.message })
    }

    const approvedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      { approved: true },
      { new: true, runValidators: true }
    )

    if (!approvedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    return res.status(200).json({
      message: 'Package approved successfully',
      data: approvedPackage,
    })
  } catch (error) {
    logger.error(`Error approving package: ${error}`)
    return res.status(500).json({ message: 'Failed to approve package' })
  }
}

const unapprovePackage = async(req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const roleCheck = await checkAdminRole(req.userId)

    if (!roleCheck.ok) {
      return res.status(roleCheck.status).json({ message: roleCheck.message })
    }

    const unapprovedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      { approved: false },
      { new: true, runValidators: true }
    )

    if (!unapprovedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    return res.status(200).json({
      message: 'Package moved back to pending approval successfully',
      data: unapprovedPackage,
    })
  } catch (error) {
    logger.error(`Error unapproving package: ${error}`)
    return res.status(500).json({ message: 'Failed to unapprove package' })
  }
}

const revealPackage = async(req: Request, res: Response) => {
  if(!req.userId) return res.status(401).json({ message: 'Unauthorized' })

  try{
    const packageId = req.params.id

    if (!packageId) {
      return res.status(400).json({ message: 'Package id is required' })
    }

    const existingPackage = await Package.findById(packageId)

    if(!existingPackage) return res.status(404).json({ message: 'Package not found' })

    const alreadyRevealed = await UserPackageReveal.findOne({
      packageId,
      userId: req.userId,
    })

    if (alreadyRevealed) {
      return res.status(200).json({ message: 'Package already revealed', data: existingPackage })
    }

    await UserPackageReveal.create({
      packageId,
      userId: req.userId,
    })

    return res.status(200).json({ message: 'Package revealed successfully', data: existingPackage })
  }
  catch(err: any){
    logger.error(err.message)
    return res.status(500).json({ message: 'Failed to reveal package' })
  }
} 

const likePackage = async(req: Request, res: Response) => {
  if(!req.userId) return res.status(401).json({ message: 'Unauthorized' })

  try{
    const packageId = req.params.id

    if (!packageId) {
      return res.status(400).json({ message: 'Package id is required' })
    }

    const existingPackage = await Package.findById(packageId)

    if(!existingPackage) return res.status(404).json({ message: 'Package not found' })

    const alreadyLikedPackage = await LikedPackage.findOne({
      packageId,
      userId: req.userId,
    })

    if (alreadyLikedPackage) {
      return res.status(200).json({ message: 'Package already liked', data: existingPackage, alreadyLiked: true })
    }

    await LikedPackage.create({
      packageId,
      userId: req.userId,
    })

    return res.status(200).json({ message: 'Package liked successfully', data: existingPackage, alreadyLiked: false })
  }
  catch(err: any){
    logger.error(err.message)
    return res.status(500).json({ message: 'Failed to like package' })
  }
} 

const getLikedPackages = async(req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const REDIS_CACHE_KEY = `packages:liked:${req.userId}`

    const cached = await redis.get(REDIS_CACHE_KEY)

    if (cached) {
      logger.info('cache hit')
      return res.status(200).json(JSON.parse(cached))
    }

    const likedRecords = await LikedPackage.find({ userId: req.userId }).lean()

    if (likedRecords.length === 0) {
      const response = {
        message: 'No liked packages found',
        data: [],
      }

      await redis.set(REDIS_CACHE_KEY, JSON.stringify(response), 'EX', REDIS_TTL)

      logger.info('cache miss')
      return res.status(200).json(response)
    }

    const packageIds = [
      ...new Set(
        likedRecords
          .map((record) => record.packageId)
          .filter((id): id is string => Boolean(id && id.trim()))
      ),
    ]

    if (packageIds.length === 0) {
      const response = {
        message: 'No valid liked package ids found',
        data: [],
      }

      await redis.set(REDIS_CACHE_KEY, JSON.stringify(response), 'EX', REDIS_TTL)

      logger.info('cache miss')
      return res.status(200).json(response)
    }

    const likedPackages = await Package.find({ _id: { $in: packageIds } })
      .populate(packagePopulateConfig)
      .sort({ updatedAt: -1 })

    const response = {
      message: 'Liked packages fetched successfully',
      data: likedPackages
    }

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(response), 'EX', REDIS_TTL)

    logger.info('cache miss')
    return res.status(200).json(response)

  } catch (error) {
    logger.error(`Error fetching liked packages: ${error}`)

    return res.status(500).json({ message: 'Failed to get liked packages' })
  }
}

export {
  getPackages,
  viewPackage,
  discoverPackage,
  getPendingPackages,
  postPackage,
  updatePackage,
  postPackageReview,
  getReviewEligibility,
  getPackageReviews,
  deletePackage,
  approvePackage,
  unapprovePackage,
  revealPackage,
  getLikedPackages,
  likePackage,
}
