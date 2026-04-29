import { Request, Response } from 'express'

import logger from '../config/logger'

import Package from '../models/Package' 

import PackageReview from '../models/PackageReviews' 

import UserPackageReveal from '../models/UserPackageReveal'

import type { PopulateOptions } from 'mongoose'

import { createPackageSchema, validateSchema, updatePackageSchema, createReviewSchema, sortPackageSchema } from '../utils/validSchema'

import { checkAdminRole } from '../utils/roleCheck'

const packagePopulateConfig: PopulateOptions[] = [
  { path: 'hotels', select: 'name phoneNumber address photos budget' },
  { path: 'vehicles', select: 'car carNumber driverName driverPhoneNumber vehicleType budget' },
]

const isAdminUser = async (userId?: string): Promise<boolean> => {
  if (!userId) {
    return false
  }

  const roleCheck = await checkAdminRole(userId)

  if (!roleCheck.ok && roleCheck.status === 500) {
    logger.error(`Admin role check failed for user ${userId}: ${roleCheck.message}`)
  }

  return roleCheck.ok
}

const getPackages = async (req: Request, res: Response) => {
  try {
    const packages = await Package.find({ approved: true }).populate(packagePopulateConfig)

    return res.status(200).json(packages)
  } catch (error) {
    logger.error(`Error fetching package list: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch packages' })
  }
}

const viewPackage = async (req: Request, res: Response) => { 
  const packageId = req.params.id 

  try {
    const packageData = await Package.findById(packageId).populate(packagePopulateConfig)

    if (!packageData) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const isAdmin = await isAdminUser(req.userId)
    const canViewPackage = packageData.approved || packageData.createdBy === req.userId || isAdmin

    if (!canViewPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

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

    const isAdmin = await isAdminUser(req.userId)
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

    const isAdmin = await isAdminUser(req.userId)
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
    const isAdmin = await isAdminUser(req.userId)

    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden: admin access required' })
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

export {
  getPackages,
  viewPackage,
  discoverPackage,
  getPendingPackages,
  postPackage,
  updatePackage,
  postPackageReview,
  deletePackage,
  approvePackage,
  unapprovePackage,
  revealPackage,
}