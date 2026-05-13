import { Request, Response } from 'express'

import redis from '../config/redis'

import logger from '../config/logger'

import Package, { type IPackage, type PackageStatus } from '../models/Package' 

import PackageReview from '../models/PackageReviews'

import User from '../models/User'

import UserPackageReveal from '../models/UserPackageReveal'

import LikedPackage from '../models/LikedPackage'

import type { PopulateOptions } from 'mongoose'

import {
  createPackageSchema,
  draftPackageSchema,
  validateSchema,
  updatePackageSchema,
  createReviewSchema,
  sortPackageSchema,
} from '../utils/validSchema'

import { checkAdminRole } from '../utils/roleCheck'

import { buildReviewEligibility } from '../utils/reviewEligibility'

import { computeFeaturedPackageScore, getCurrentMonthKey } from '../utils/featuredPackage'

import {
  normalizeStringList,
  normalizeDraftHotels,
  normalizeDraftVehicles,
  normalizeDraftPayload,
  normalizeObjectIdList,
} from '../utils/draftNormalizer'

import { createRelatedPackageRecords } from '../utils/packageHelpers'

const packagePopulateConfig: PopulateOptions[] = [
  { path: 'hotels', select: 'name phoneNumber address photos budget' },
  { path: 'vehicles', select: 'car carNumber driverName driverPhoneNumber vehicleType budget' },
]

const REVIEW_DELAY_DAYS = 3
const REVIEW_DELAY_MS = REVIEW_DELAY_DAYS * 24 * 60 * 60 * 1000

const REDIS_TTL = 3600
const FEATURED_REDIS_TTL = 900

const toIdString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'toString' in value) {
    return String(value)
  }

  return ''
}

const getMonthlyViewCount = (monthlyViews: unknown, monthKey: string): number => {
  if (!monthlyViews) {
    return 0
  }

  if (monthlyViews instanceof Map) {
    return Number(monthlyViews.get(monthKey) || 0)
  }

  if (typeof monthlyViews === 'object') {
    const record = monthlyViews as Record<string, unknown>
    return Number(record[monthKey] || 0)
  }

  return 0
}

const PACKAGE_STATUSES = {
  draft: 'draft',
  pendingApproval: 'pending_approval',
  approved: 'approved',
  rejected: 'rejected',
} as const

const approvedPackageQuery = {
  $or: [
    { status: PACKAGE_STATUSES.approved },
    { approved: true },
  ],
}

const pendingPackageQuery = {
  $or: [
    { status: PACKAGE_STATUSES.pendingApproval },
    { status: { $exists: false }, approved: false },
  ],
}

const getPackageStatus = (packageData: Pick<IPackage, 'status' | 'approved'>): PackageStatus => {
  if (packageData.status) {
    return packageData.status
  }

  return packageData.approved ? PACKAGE_STATUSES.approved : PACKAGE_STATUSES.pendingApproval
}

const isPackageOwner = (packageData: Pick<IPackage, 'createdBy'>, userId: string) =>
  String(packageData.createdBy) === userId

const hasMeaningfulValue = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.some(hasMeaningfulValue)
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some(hasMeaningfulValue)
  }

  return false
}

const asCacheKeyPart = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : undefined
  }

  return value ? String(value) : undefined
}

const clearPackageCaches = async (packageId?: unknown, userId?: unknown) => {
  const safePackageId = asCacheKeyPart(packageId)
  const safeUserId = asCacheKeyPart(userId)
  const keys = ['packages:list:approved:true']

  if (safePackageId) {
    keys.push(`package:${safePackageId}`, `package:${safePackageId}:reviews`)
  }

  if (safeUserId) {
    keys.push(`packages:created:${safeUserId}`, `packages:liked:${safeUserId}`)
  }

  try {
    await redis.del(...keys)
  } catch (error) {
    logger.error(`Failed to clear package cache: ${error}`)
  }
}

const canManagePackage = async (packageData: IPackage, userId: string) => {
  const roleCheck = await checkAdminRole(userId)
  const isAdmin = roleCheck.ok

  if (!isAdmin && roleCheck.status === 500) {
    logger.error(`Admin role check failed for user ${userId}: ${roleCheck.message}`)
  }

  return {
    isAdmin,
    isOwner: isPackageOwner(packageData, userId),
  }
}

const getPackages = async (req: Request, res: Response) => {
  const REDIS_CACHE_KEY = 'packages:list:approved:true'
  try {
    const cached = await redis.get(REDIS_CACHE_KEY)

    if(cached) {
      logger.info('cache hit')
      return res.status(200).json(JSON.parse(cached))
    }

    const packages = await Package.find(approvedPackageQuery).populate(packagePopulateConfig)

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(packages), 'EX', REDIS_TTL)

    logger.info('cache miss')
    return res.status(200).json(packages)
  } catch (error) {
    logger.error(`Error fetching package list: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch packages' })
  }
}

const getFeaturedPackage = async (_req: Request, res: Response) => {
  const REDIS_CACHE_KEY = 'packages:featured:best'

  try {
    const cached = await redis.get(REDIS_CACHE_KEY)

    if (cached) {
      logger.info('cache hit')
      return res.status(200).json(JSON.parse(cached))
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthKey = getCurrentMonthKey()

    const approvedPackages = await Package.find({ approved: true }).lean()

    if (approvedPackages.length === 0) {
      return res.status(404).json({ message: 'No approved packages found' })
    }

    const packageIds = approvedPackages
      .map((pkg) => toIdString(pkg._id))
      .filter((id) => id.length > 0)

    const likesLast7Days = await LikedPackage.aggregate([
      { $match: { packageId: { $in: packageIds }, createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$packageId', count: { $sum: 1 } } },
    ])

    const likesAllTime = await LikedPackage.aggregate([
      { $match: { packageId: { $in: packageIds } } },
      { $group: { _id: '$packageId', count: { $sum: 1 } } },
    ])

    const reviewsLast7Days = await PackageReview.aggregate([
      { $match: { packageId: { $in: packageIds }, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: '$packageId',
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ])

    const likesLast7DayMap = new Map(likesLast7Days.map((item) => [String(item._id), Number(item.count || 0)]))
    const likesAllTimeMap = new Map(likesAllTime.map((item) => [String(item._id), Number(item.count || 0)]))
    const reviewMap = new Map(
      reviewsLast7Days.map((item) => [
        String(item._id),
        {
          avgRating: Number(item.avgRating || 0),
          reviewCount: Number(item.reviewCount || 0),
        },
      ]),
    )

    const packageMetrics = approvedPackages.map((pkg) => {
      const id = toIdString(pkg._id)
      const likes7d = likesLast7DayMap.get(id) || 0
      const reviewStats = reviewMap.get(id)
      const reviewCount7d = reviewStats?.reviewCount || 0

      return {
        packageDoc: pkg,
        id,
        monthlyViews: getMonthlyViewCount((pkg as { monthlyViews?: unknown }).monthlyViews, monthKey),
        likes7d,
        avgRating7d: reviewStats?.avgRating || 0,
        reviewCount7d,
        hasEngagement: likes7d > 0 || reviewCount7d > 0,
      }
    })

    const scoredCandidates = packageMetrics.filter((item) => item.hasEngagement)

    let selected = null as null | (typeof packageMetrics)[number]

    if (scoredCandidates.length > 0) {
      const maxMonthlyViews = scoredCandidates.reduce((max, item) => Math.max(max, item.monthlyViews), 0)
      const maxLikes7d = scoredCandidates.reduce((max, item) => Math.max(max, item.likes7d), 0)

      selected = scoredCandidates
        .map((item) => ({
          ...item,
          score: computeFeaturedPackageScore(
            {
              monthlyViews: item.monthlyViews,
              likesLast7Days: item.likes7d,
              avgRatingLast7Days: item.avgRating7d,
              reviewCountLast7Days: item.reviewCount7d,
              createdAt: new Date(item.packageDoc.createdAt),
            },
            {
              monthlyViews: maxMonthlyViews,
              likesLast7Days: maxLikes7d,
            },
          ),
        }))
        .sort((a, b) => b.score - a.score)[0]
    }

    if (!selected) {
      selected = [...packageMetrics]
        .sort((a, b) => (b.likes7d - a.likes7d) || (b.monthlyViews - a.monthlyViews))[0]
    }

    if (!selected || selected.id.length === 0) {
      return res.status(404).json({ message: 'No package available for featured slot' })
    }

    const selectedLikesAllTime = likesAllTimeMap.get(selected.id) || 0

    if (selectedLikesAllTime === 0) {
      const fallbackByAllTimeLikes = [...packageMetrics].sort((a, b) => {
        const likeDiff = (likesAllTimeMap.get(b.id) || 0) - (likesAllTimeMap.get(a.id) || 0)
        if (likeDiff !== 0) {
          return likeDiff
        }

        return b.monthlyViews - a.monthlyViews
      })[0]

      if (fallbackByAllTimeLikes) {
        selected = fallbackByAllTimeLikes
      }
    }

    const featuredPackage = await Package.findById(selected.id).populate(packagePopulateConfig)

    if (!featuredPackage) {
      return res.status(404).json({ message: 'Featured package not found' })
    }

    const response = {
      message: 'Featured package fetched successfully',
      data: featuredPackage,
    }

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(response), 'EX', FEATURED_REDIS_TTL)

    logger.info('cache miss')
    return res.status(200).json(response)
  } catch (error) {
    logger.error(`Error fetching featured package: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch featured package' })
  }
}

const viewPackage = async (req: Request, res: Response) => { 
  const packageId = req.params.id 
  const monthKey = getCurrentMonthKey()
  const viewIncrement = {
    $inc: {
      views: 1,
      [`monthlyViews.${monthKey}`]: 1,
    },
  }

  try {
    const REDIS_CACHE_KEY = `package:${packageId}`

    const cached = await redis.get(REDIS_CACHE_KEY)

    if(cached){
      const cachedPackage = JSON.parse(cached)

      if (!cachedPackage?.createdByName) {
        const createdByName = await getUserNameByIdentifier(String(cachedPackage?.createdBy || ''))
        const enrichedCachedPackage = {
          ...cachedPackage,
          createdByName,
        }

        await redis.set(REDIS_CACHE_KEY, JSON.stringify(enrichedCachedPackage), 'EX', REDIS_TTL)

        void Package.updateOne({ _id: packageId }, viewIncrement).catch((error) => {
          logger.error(`Failed to update package views for ${packageId}: ${error}`)
        })

        return res.status(200).json(enrichedCachedPackage)
      }

      void Package.updateOne({ _id: packageId }, viewIncrement).catch((error) => {
        logger.error(`Failed to update package views for ${packageId}: ${error}`)
      })
      return res.status(200).json(cachedPackage)
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
    const packageStatus = getPackageStatus(packageData)
    const canViewPackage =
      packageStatus === PACKAGE_STATUSES.approved ||
      (req.userId ? isPackageOwner(packageData, req.userId) : false) ||
      isAdmin

    if (!canViewPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    if (packageStatus === PACKAGE_STATUSES.approved) {
      await redis.set(REDIS_CACHE_KEY, JSON.stringify(packageData), 'EX', REDIS_TTL)

    void Package.updateOne({ _id: packageData._id }, viewIncrement).catch((error) => {
      logger.error(`Failed to update package views for ${packageId}: ${error}`)
    })
    }

    return res.status(200).json(packageResponse)
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
    const filters: Record<string, unknown>[] = [approvedPackageQuery]
    const query: Record<string, unknown> = {}

    if (search) {
      filters.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { destination: { $regex: search, $options: 'i' } },
        ],
      })
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

    filters.push(query)
    const packageQuery =
      filters.length === 1
        ? filters[0]
        : { $and: filters.filter((filter) => Object.keys(filter).length > 0) }

    const sortOrder = order === 'asc' ? 1 : -1
    const skip = (page - 1) * limit

    const [packages, total] = await Promise.all([
      Package.find(packageQuery)
        .populate(packagePopulateConfig)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      Package.countDocuments(packageQuery),
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
    const {
      draftHotels: _draftHotels,
      draftVehicles: _draftVehicles,
      hotels: _hotels,
      vehicles: _vehicles,
      ...packageData
    } = validation.data
    const relatedRecords = await createRelatedPackageRecords(validation.data, req.userId)

    const createdPackage = await Package.create({
      ...packageData,
      ...relatedRecords,
      createdBy: req.userId,
      approved: false,
      status: PACKAGE_STATUSES.pendingApproval,
      submittedAt: new Date(),
      reviewedAt: undefined,
      reviewedBy: undefined,
      rejectionReason: undefined,
      draftHotels: [],
      draftVehicles: [],
    })

    const populatedPackage = await Package.findById(createdPackage._id).populate(packagePopulateConfig)
    await clearPackageCaches(createdPackage._id.toString(), req.userId)

    return res.status(201).json({
      message: "Package submitted for approval successfully",
      data: populatedPackage ?? createdPackage,
    })
  }catch(error){
    logger.error(`Error creating package: ${error}`)
    return res.status(500).json({ message: "Failed to create Package" })
  }
}

const createDraftPackage = async (req: Request, res: Response) => {
  logger.info('createDraftPackage endpoint called')

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const validation = validateSchema(draftPackageSchema, req.body)

  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  const draftData = normalizeDraftPayload(validation.data)

  if (!hasMeaningfulValue(draftData)) {
    return res.status(400).json({ message: 'Add at least one package detail before saving a draft' })
  }

  try {
    const createdPackage = await Package.create({
      ...draftData,
      createdBy: req.userId,
      approved: false,
      status: PACKAGE_STATUSES.draft,
      submittedAt: undefined,
      reviewedAt: undefined,
      reviewedBy: undefined,
      rejectionReason: undefined,
    })

    const populatedPackage = await Package.findById(createdPackage._id).populate(packagePopulateConfig)
    await clearPackageCaches(createdPackage._id.toString(), req.userId)

    return res.status(201).json({
      message: 'Draft package saved successfully',
      data: populatedPackage ?? createdPackage,
    })
  } catch (error) {
    logger.error(`Error saving draft package: ${error}`)
    return res.status(500).json({ message: 'Failed to save draft package' })
  }
}

const getDraftPackages = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const packages = await Package.find({
      createdBy: req.userId,
      status: { $in: [PACKAGE_STATUSES.draft, PACKAGE_STATUSES.rejected] },
    })
      .populate(packagePopulateConfig)
      .sort({ updatedAt: -1 })

    return res.status(200).json({
      message: 'Draft packages fetched successfully',
      data: packages,
    })
  } catch (error) {
    logger.error(`Error fetching draft packages: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch draft packages' })
  }
}

const getEditablePackage = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const packageId = req.params.id

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  try {
    const packageData = await Package.findById(packageId).populate(packagePopulateConfig)

    if (!packageData) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const { isAdmin, isOwner } = await canManagePackage(packageData, req.userId)

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you cannot edit this package' })
    }

    return res.status(200).json({
      message: 'Editable package fetched successfully',
      data: packageData,
    })
  } catch (error) {
    logger.error(`Error fetching editable package: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch editable package' })
  }
}

const updateDraftPackage = async (req: Request, res: Response) => {
  const packageId = req.params.id
  logger.info(`updateDraftPackage endpoint called for id: ${packageId || 'not provided'}`)

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  const validation = validateSchema(draftPackageSchema, req.body)

  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  try {
    const existingPackage = await Package.findById(packageId)

    if (!existingPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const { isAdmin, isOwner } = await canManagePackage(existingPackage, req.userId)

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you cannot update this draft' })
    }

    const existingStatus = getPackageStatus(existingPackage)

    if (existingStatus !== PACKAGE_STATUSES.draft && existingStatus !== PACKAGE_STATUSES.rejected) {
      return res.status(409).json({ message: 'Only draft or rejected packages can be edited as drafts' })
    }

    const draftData = normalizeDraftPayload(validation.data)

    const updatedPackage = await Package.findByIdAndUpdate(
      packageId,
      {
        ...draftData,
        approved: false,
        status: PACKAGE_STATUSES.draft,
        submittedAt: undefined,
        reviewedAt: undefined,
        reviewedBy: undefined,
        rejectionReason: undefined,
      },
      { new: true, runValidators: true },
    ).populate(packagePopulateConfig)

    if (!updatedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    await clearPackageCaches(packageId, existingPackage.createdBy)

    return res.status(200).json({
      message: 'Draft package updated successfully',
      data: updatedPackage,
    })
  } catch (error) {
    logger.error(`Error updating draft package: ${error}`)
    return res.status(500).json({ message: 'Failed to update draft package' })
  }
}

const submitPackageForApproval = async (req: Request, res: Response) => {
  const packageId = req.params.id
  logger.info(`submitPackageForApproval endpoint called for id: ${packageId || 'not provided'}`)

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  try {
    const existingPackage = await Package.findById(packageId)

    if (!existingPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const { isAdmin, isOwner } = await canManagePackage(existingPackage, req.userId)

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you cannot submit this package' })
    }

    const existingStatus = getPackageStatus(existingPackage)

    if (existingStatus !== PACKAGE_STATUSES.draft && existingStatus !== PACKAGE_STATUSES.rejected) {
      return res.status(409).json({ message: 'Only draft or rejected packages can be submitted for approval' })
    }

    const submissionCandidate = {
      name: existingPackage.name,
      description: existingPackage.description,
      coverImage: existingPackage.coverImage,
      season: existingPackage.season,
      budget: existingPackage.budget,
      destination: existingPackage.destination,
      spots: existingPackage.spots,
      duration: existingPackage.duration,
      startDate: existingPackage.startDate,
      endDate: existingPackage.endDate,
      identification: existingPackage.identification,
      permit: existingPackage.permit,
      tags: existingPackage.tags,
      affiliateLinks: existingPackage.affiliateLinks,
      additional: existingPackage.additional,
      hotels: normalizeObjectIdList(existingPackage.hotels as unknown[] | undefined),
      vehicles: normalizeObjectIdList(existingPackage.vehicles as unknown[] | undefined),
      draftHotels: existingPackage.draftHotels,
      draftVehicles: existingPackage.draftVehicles,
    }

    const validation = validateSchema(createPackageSchema, submissionCandidate)

    if (!validation.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.errors,
      })
    }

    const {
      draftHotels: _draftHotels,
      draftVehicles: _draftVehicles,
      hotels: _hotels,
      vehicles: _vehicles,
      ...packageData
    } = validation.data
    const relatedRecords = await createRelatedPackageRecords(validation.data, existingPackage.createdBy)

    const updatedPackage = await Package.findByIdAndUpdate(
      packageId,
      {
        ...packageData,
        ...relatedRecords,
        approved: false,
        status: PACKAGE_STATUSES.pendingApproval,
        submittedAt: new Date(),
        reviewedAt: undefined,
        reviewedBy: undefined,
        rejectionReason: undefined,
        draftHotels: [],
        draftVehicles: [],
      },
      { new: true, runValidators: true },
    ).populate(packagePopulateConfig)

    if (!updatedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    await clearPackageCaches(packageId, existingPackage.createdBy)

    return res.status(200).json({
      message: 'Package submitted for approval successfully',
      data: updatedPackage,
    })
  } catch (error) {
    logger.error(`Error submitting package for approval: ${error}`)
    return res.status(500).json({ message: 'Failed to submit package for approval' })
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

    const { isAdmin, isOwner } = await canManagePackage(existingPackage, req.userId)

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you cannot update this package' })
    }

    const shouldRequireReapproval =
      !isAdmin && getPackageStatus(existingPackage) === PACKAGE_STATUSES.approved

    const updateData = {
      ...validation.data,
      ...(shouldRequireReapproval
        ? {
            approved: false,
            status: PACKAGE_STATUSES.pendingApproval,
            submittedAt: new Date(),
            reviewedAt: undefined,
            reviewedBy: undefined,
            rejectionReason: undefined,
          }
        : {}),
    }

    const updatedPackage = await Package.findByIdAndUpdate(
      packageId,
      updateData,
      { new: true, runValidators: true }
    ).populate(packagePopulateConfig)

    if (!updatedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    await clearPackageCaches(packageId, existingPackage.createdBy)

    return res.status(200).json({
      message:
        shouldRequireReapproval
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

    const existingPackage = await Package.findById(packageId)
    if (!existingPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    if (getPackageStatus(existingPackage) !== PACKAGE_STATUSES.approved) {
      return res.status(403).json({ message: 'Only approved packages can be reviewed' })
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

    const existingPackage = await Package.findById(packageId)
    if (!existingPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    if (getPackageStatus(existingPackage) !== PACKAGE_STATUSES.approved) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const reviews = await PackageReview.find({ packageId })
      .sort({ createdAt: -1 })
      .lean()

    const userIds = [...new Set(reviews.map((r) => String(r.userId || '')).filter((id) => id.length > 0))]
    const objectIdUserIds = userIds.filter(isObjectIdString)

    const userFilters: Array<Record<string, unknown>> = []

    if (objectIdUserIds.length > 0) {
      userFilters.push({ _id: { $in: objectIdUserIds } })
    }

    if (userIds.length > 0) {
      userFilters.push({ firebaseId: { $in: userIds } })
    }

    const users = userFilters.length > 0
      ? await User.find({ $or: userFilters }).select('_id firebaseId name profilePicture').lean()
      : []

    const userMap = new Map<string, { name?: string; profilePicture?: string }>()
    for (const user of users) {
      if (user.firebaseId) {
        userMap.set(user.firebaseId, user)
      }
      userMap.set(String(user._id), user)
    }

    const enrichedReviews = reviews.map((r) => {
      const reviewer = userMap.get(String(r.userId))
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

    const { isAdmin, isOwner } = await canManagePackage(existingPackage, req.userId)

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you cannot delete this package' })
    }

    if (getPackageStatus(existingPackage) === PACKAGE_STATUSES.approved && !isAdmin) {
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
    await clearPackageCaches(packageId, existingPackage.createdBy)

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

    const packages = await Package.find(pendingPackageQuery)
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

    const existingPackage = await Package.findById(req.params.id)

    if (!existingPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const currentStatus = getPackageStatus(existingPackage)

    if (currentStatus === PACKAGE_STATUSES.draft) {
      return res.status(400).json({ message: 'Draft packages must be submitted before approval' })
    }

    if (currentStatus === PACKAGE_STATUSES.rejected) {
      return res.status(400).json({ message: 'Rejected packages must be resubmitted before approval' })
    }

    const approvedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      {
        approved: true,
        status: PACKAGE_STATUSES.approved,
        reviewedAt: new Date(),
        reviewedBy: req.userId,
        rejectionReason: undefined,
      },
      { new: true, runValidators: true }
    ).populate(packagePopulateConfig)

    if (!approvedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    await clearPackageCaches(req.params.id, existingPackage.createdBy)

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

    const existingPackage = await Package.findById(req.params.id)

    if (!existingPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const unapprovedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      {
        approved: false,
        status: PACKAGE_STATUSES.pendingApproval,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: req.userId,
        rejectionReason: undefined,
      },
      { new: true, runValidators: true }
    ).populate(packagePopulateConfig)

    if (!unapprovedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    await clearPackageCaches(req.params.id, existingPackage.createdBy)

    return res.status(200).json({
      message: 'Package moved back to pending approval successfully',
      data: unapprovedPackage,
    })
  } catch (error) {
    logger.error(`Error unapproving package: ${error}`)
    return res.status(500).json({ message: 'Failed to unapprove package' })
  }
}

const rejectPackage = async(req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const roleCheck = await checkAdminRole(req.userId)

    if (!roleCheck.ok) {
      return res.status(roleCheck.status).json({ message: roleCheck.message })
    }

    const packageId = req.params.id
    const existingPackage = await Package.findById(packageId)

    if (!existingPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    if (getPackageStatus(existingPackage) !== PACKAGE_STATUSES.pendingApproval) {
      return res.status(400).json({ message: 'Only pending packages can be rejected' })
    }

    const rejectionReason =
      typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim()
        : undefined

    const rejectedPackage = await Package.findByIdAndUpdate(
      packageId,
      {
        approved: false,
        status: PACKAGE_STATUSES.rejected,
        reviewedAt: new Date(),
        reviewedBy: req.userId,
        rejectionReason,
      },
      { new: true, runValidators: true },
    ).populate(packagePopulateConfig)

    if (!rejectedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    await clearPackageCaches(packageId, existingPackage.createdBy)

    return res.status(200).json({
      message: 'Package rejected successfully',
      data: rejectedPackage,
    })
  } catch (error) {
    logger.error(`Error rejecting package: ${error}`)
    return res.status(500).json({ message: 'Failed to reject package' })
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

    if (getPackageStatus(existingPackage) !== PACKAGE_STATUSES.approved) {
      return res.status(403).json({ message: 'Only approved packages can be revealed' })
    }

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

    if (getPackageStatus(existingPackage) !== PACKAGE_STATUSES.approved) {
      return res.status(403).json({ message: 'Only approved packages can be liked' })
    }

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

    const likedPackages = await Package.find({
      $and: [
        { _id: { $in: packageIds } },
        approvedPackageQuery,
      ],
    })
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
  getFeaturedPackage,
  viewPackage,
  discoverPackage,
  getPendingPackages,
  postPackage,
  createDraftPackage,
  getDraftPackages,
  getEditablePackage,
  updateDraftPackage,
  submitPackageForApproval,
  updatePackage,
  postPackageReview,
  getReviewEligibility,
  getPackageReviews,
  deletePackage,
  approvePackage,
  unapprovePackage,
  rejectPackage,
  revealPackage,
  getLikedPackages,
  likePackage,
}
