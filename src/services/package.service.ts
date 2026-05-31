import type { PopulateOptions } from 'mongoose'

import redis from '../config/redis'
import logger from '../config/logger'

import Package, { type IPackage, type PackageStatus } from '../models/Package'
import PackageReview from '../models/PackageReviews'
import User from '../models/User'
import UserPackageReveal from '../models/UserPackageReveal'
import LikedPackage from '../models/LikedPackage'
import Hotel from '../models/Hotel'
import Vehicle from '../models/Vehicle'

import { checkAdminRole } from '../utils/roleCheck'
import { buildReviewEligibility } from '../utils/reviewEligibility'
import { computeFeaturedPackageScore, getCurrentMonthKey } from '../utils/featuredPackage'
import { isObjectIdString, toIdString } from '../utils/id'
import { hasMeaningfulValue, normalizeObjectIdList, normalizeStringList } from '../utils/normalize'
import { deleteOldPackageCoverImage, isLocalPackageCoverImagePath } from '../utils/uploadPackageCoverImage'
import { createPackageSchema, validateSchema, type CreatePackageInput, type CreateReviewInput, type DraftPackageInput } from '../utils/validSchema'

const packagePopulateConfig: PopulateOptions[] = [
  { path: 'hotels', select: 'name phoneNumber address photos budget' },
  { path: 'vehicles', select: 'car carNumber driverName driverPhoneNumber vehicleType budget' },
]

const REDIS_TTL = 3600
const FEATURED_REDIS_TTL = 900
const PUBLIC_PACKAGE_SAFE_SELECT = '-hotels -vehicles -draftHotels -draftVehicles'

export const PACKAGE_STATUSES = {
  draft: 'draft',
  pendingApproval: 'pending_approval',
  approved: 'approved',
  rejected: 'rejected',
} as const

export const approvedPackageQuery = {
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

type PackageStatusCandidate = {
  status?: PackageStatus
  approved: boolean
  $isDefault?: (path?: string) => boolean
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

export const getPackageStatus = (packageData: PackageStatusCandidate): PackageStatus => {
  if (packageData.approved || packageData.status === PACKAGE_STATUSES.approved) {
    return PACKAGE_STATUSES.approved
  }

  const statusWasDefaulted =
    typeof packageData.$isDefault === 'function' && packageData.$isDefault('status')

  if (packageData.status && !statusWasDefaulted) {
    return packageData.status
  }

  return PACKAGE_STATUSES.pendingApproval
}

export const normalizePackageStatusForResponse = <T extends PackageStatusCandidate | null>(packageData: T): T => {
  if (!packageData) {
    return packageData
  }

  const status = getPackageStatus(packageData)
  packageData.status = status
  packageData.approved = status === PACKAGE_STATUSES.approved

  return packageData
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

const normalizeDraftHotels = (hotels?: DraftPackageInput['draftHotels']) =>
  (hotels ?? [])
    .filter(hasMeaningfulValue)
    .map((hotel) => ({
      name: hotel.name?.trim() ?? '',
      phoneNumber: hotel.phoneNumber?.trim() ?? '',
      address: hotel.address?.trim() ?? '',
      photos: normalizeStringList(hotel.photos),
      ...(hotel.budget !== undefined ? { budget: hotel.budget } : {}),
    }))

const normalizeDraftVehicles = (vehicles?: DraftPackageInput['draftVehicles']) =>
  (vehicles ?? [])
    .filter(hasMeaningfulValue)
    .map((vehicle) => ({
      car: vehicle.car?.trim() ?? '',
      carNumber: vehicle.carNumber?.trim() ?? '',
      driverName: vehicle.driverName?.trim() ?? '',
      driverPhoneNumber: vehicle.driverPhoneNumber?.trim() ?? '',
      vehicleType: vehicle.vehicleType?.trim() ?? '',
      ...(vehicle.budget !== undefined ? { budget: vehicle.budget } : {}),
    }))

export const normalizeDraftPayload = (data: DraftPackageInput) => ({
  ...data,
  ...(data.spots ? { spots: normalizeStringList(data.spots) } : {}),
  ...(data.tags ? { tags: normalizeStringList(data.tags) } : {}),
  ...(data.affiliateLinks ? { affiliateLinks: normalizeStringList(data.affiliateLinks) } : {}),
  ...(data.draftHotels ? { draftHotels: normalizeDraftHotels(data.draftHotels) } : {}),
  ...(data.draftVehicles ? { draftVehicles: normalizeDraftVehicles(data.draftVehicles) } : {}),
})

const isPackageOwner = (packageData: Pick<IPackage, 'createdBy'>, userId: string) =>
  String(packageData.createdBy) === userId

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

const getUserNameByIdentifier = async (identifier: string): Promise<string> => {
  if (!identifier) {
    return 'Anonymous'
  }

  const user = isObjectIdString(identifier)
    ? await User.findById(identifier).select('name').lean()
    : await User.findOne({ firebaseId: identifier }).select('name').lean()

  return user?.name || 'Anonymous'
}

const sanitizePackageForViewer = (
  packageData: Record<string, unknown>,
  canViewSensitive: boolean,
) => {
  if (canViewSensitive) {
    return packageData
  }

  const {
    hotels: _hotels,
    vehicles: _vehicles,
    draftHotels: _draftHotels,
    draftVehicles: _draftVehicles,
    ...safePackageData
  } = packageData

  return {
    ...safePackageData,
    hotels: [],
    vehicles: [],
  }
}

const createRelatedPackageRecords = async (
  data: CreatePackageInput,
  userId: string,
): Promise<{ hotels: string[]; vehicles: string[] }> => {
  const hotelIds = [...data.hotels]
  const vehicleIds = [...data.vehicles]

  if (data.draftHotels.length > 0) {
    const createdHotels = await Hotel.insertMany(data.draftHotels.map((hotel) => ({ ...hotel, createdBy: userId })))
    hotelIds.push(...createdHotels.map((hotel) => hotel._id.toString()))
  }

  if (data.draftVehicles.length > 0) {
    const createdVehicles = await Vehicle.insertMany(data.draftVehicles.map((vehicle) => ({ ...vehicle, createdBy: userId })))
    vehicleIds.push(...createdVehicles.map((vehicle) => vehicle._id.toString()))
  }

  return { hotels: hotelIds, vehicles: vehicleIds }
}

const buildSubmissionCandidate = (
  existingPackage: IPackage,
  incomingData: unknown,
): Record<string, unknown> => {
  const existing = existingPackage.toObject() as Record<string, unknown>
  const incoming = incomingData && typeof incomingData === 'object'
    ? incomingData as Record<string, unknown>
    : {}

  return {
    name: existing.name,
    description: existing.description,
    coverImage: existing.coverImage,
    season: existing.season,
    budget: existing.budget,
    destination: existing.destination,
    spots: existing.spots,
    duration: existing.duration,
    startDate: existing.startDate,
    endDate: existing.endDate,
    identification: existing.identification,
    permit: existing.permit,
    tags: existing.tags,
    affiliateLinks: existing.affiliateLinks,
    additional: existing.additional,
    hotels: normalizeObjectIdList(existing.hotels as unknown[] | undefined),
    vehicles: normalizeObjectIdList(existing.vehicles as unknown[] | undefined),
    draftHotels: existing.draftHotels,
    draftVehicles: existing.draftVehicles,
    ...incoming,
  }
}

export const getApprovedPackages = async (page: number) => {
  const pkgPerPage = 10
  const cacheKey = `packages:list:approved:true:${page}`
  const cached = await redis.get(cacheKey)

  if (cached) {
    logger.info('cache hit')
    return JSON.parse(cached)
  }

  const packages = await Package.find(approvedPackageQuery)
    .select(PUBLIC_PACKAGE_SAFE_SELECT)
    .skip(page * pkgPerPage)
    .limit(pkgPerPage)

  await redis.set(cacheKey, JSON.stringify(packages), 'EX', REDIS_TTL)

  logger.info('cache miss')
  return packages
}

export const createPackageForApproval = async (data: CreatePackageInput, userId: string) => {
  const {
    draftHotels: _draftHotels,
    draftVehicles: _draftVehicles,
    hotels: _hotels,
    vehicles: _vehicles,
    ...packageData
  } = data

  const relatedRecords = await createRelatedPackageRecords(data, userId)

  const createdPackage = await Package.create({
    ...packageData,
    ...relatedRecords,
    createdBy: userId,
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
  await clearPackageCaches(createdPackage._id.toString(), userId)

  return populatedPackage ?? createdPackage
}

export const createDraftPackage = async (data: DraftPackageInput, userId: string) => {
  const draftData = normalizeDraftPayload(data)

  if (!hasMeaningfulValue(draftData)) {
    return { status: 400, body: { message: 'Add at least one package detail before saving a draft' } }
  }

  const createdPackage = await Package.create({
    ...draftData,
    createdBy: userId,
    approved: false,
    status: PACKAGE_STATUSES.draft,
    submittedAt: undefined,
    reviewedAt: undefined,
    reviewedBy: undefined,
    rejectionReason: undefined,
  })

  const populatedPackage = await Package.findById(createdPackage._id).populate(packagePopulateConfig)
  await clearPackageCaches(createdPackage._id.toString(), userId)

  return {
    status: 201,
    body: {
      message: 'Draft package saved successfully',
      data: populatedPackage ?? createdPackage,
    },
  }
}

export const updateDraftPackage = async (packageId: string, data: DraftPackageInput, userId: string) => {
  const existingPackage = await Package.findById(packageId)

  if (!existingPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const { isAdmin, isOwner } = await canManagePackage(existingPackage, userId)

  if (!isOwner && !isAdmin) {
    return { status: 403, body: { message: 'Forbidden: you cannot update this draft' } }
  }

  const existingStatus = getPackageStatus(existingPackage)

  if (existingStatus !== PACKAGE_STATUSES.draft && existingStatus !== PACKAGE_STATUSES.rejected) {
    return { status: 409, body: { message: 'Only draft or rejected packages can be edited as drafts' } }
  }

  const draftData = normalizeDraftPayload(data)
  const incomingCoverImage = typeof draftData.coverImage === 'string' ? draftData.coverImage.trim() : undefined
  const existingCoverImage = existingPackage.coverImage?.trim() || ''

  if (incomingCoverImage !== undefined && incomingCoverImage !== existingCoverImage && existingCoverImage) {
    deleteOldPackageCoverImage(existingCoverImage)
  }

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
    return { status: 404, body: { message: 'Package not found' } }
  }

  await clearPackageCaches(packageId, existingPackage.createdBy)

  return {
    status: 200,
    body: {
      message: 'Draft package updated successfully',
      data: normalizePackageStatusForResponse(updatedPackage),
    },
  }
}

export const submitPackageForApproval = async (packageId: string, incomingData: unknown, userId: string) => {
  const existingPackage = await Package.findById(packageId)

  if (!existingPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const { isAdmin, isOwner } = await canManagePackage(existingPackage, userId)

  if (!isOwner && !isAdmin) {
    return { status: 403, body: { message: 'Forbidden: you cannot submit this package' } }
  }

  const existingStatus = getPackageStatus(existingPackage)

  if (existingStatus !== PACKAGE_STATUSES.draft && existingStatus !== PACKAGE_STATUSES.rejected) {
    return { status: 409, body: { message: 'Only draft or rejected packages can be submitted for approval' } }
  }

  const validation = validateSchema(createPackageSchema, buildSubmissionCandidate(existingPackage, incomingData))

  if (!validation.success) {
    return { status: 400, body: { message: 'Validation failed', errors: validation.errors } }
  }

  const {
    draftHotels: _draftHotels,
    draftVehicles: _draftVehicles,
    hotels: _hotels,
    vehicles: _vehicles,
    ...packageData
  } = validation.data

  const incomingCoverImage = typeof packageData.coverImage === 'string' ? packageData.coverImage.trim() : undefined
  const existingCoverImage = existingPackage.coverImage?.trim() || ''

  if (incomingCoverImage !== undefined && incomingCoverImage !== existingCoverImage && existingCoverImage) {
    deleteOldPackageCoverImage(existingCoverImage)
  }

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
    return { status: 404, body: { message: 'Package not found' } }
  }

  await clearPackageCaches(packageId, existingPackage.createdBy)

  return {
    status: 200,
    body: {
      message: 'Package submitted for approval successfully',
      data: normalizePackageStatusForResponse(updatedPackage),
    },
  }
}

export const updatePackage = async (packageId: string, data: Record<string, unknown>, userId: string) => {
  const existingPackage = await Package.findById(packageId)

  if (!existingPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const { isAdmin, isOwner } = await canManagePackage(existingPackage, userId)

  if (!isOwner && !isAdmin) {
    return { status: 403, body: { message: 'Forbidden: you cannot update this package' } }
  }

  const shouldRequireReapproval = !isAdmin && getPackageStatus(existingPackage) === PACKAGE_STATUSES.approved
  const incomingCoverImage = typeof data.coverImage === 'string' ? data.coverImage.trim() : undefined
  const existingCoverImage = existingPackage.coverImage?.trim() || ''

  if (incomingCoverImage !== undefined && incomingCoverImage !== existingCoverImage && existingCoverImage) {
    deleteOldPackageCoverImage(existingCoverImage)
  }

  const updateData = {
    ...data,
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
    { new: true, runValidators: true },
  ).populate(packagePopulateConfig)

  if (!updatedPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  await clearPackageCaches(packageId, existingPackage.createdBy)

  return {
    status: 200,
    body: {
      message: shouldRequireReapproval
        ? 'Package updated successfully and requires re-approval'
        : 'Package updated successfully',
      data: normalizePackageStatusForResponse(updatedPackage),
    },
  }
}

export const viewPackage = async (packageId: string, userId: string) => {
  const monthKey = getCurrentMonthKey()
  const viewIncrement = {
    $inc: {
      views: 1,
      [`monthlyViews.${monthKey}`]: 1,
    },
  }

  const roleCheck = await checkAdminRole(userId)
  const isAdmin = roleCheck.ok

  if (!isAdmin && roleCheck.status === 500) {
    logger.error(`Admin role check failed for user ${userId}: ${roleCheck.message}`)
  }

  const cacheKey = `package:${packageId}`
  const cached = await redis.get(cacheKey)
  let packageData: Record<string, unknown>

  if (cached) {
    const parsed = JSON.parse(cached) as Record<string, unknown>

    if (!parsed.createdByName) {
      const createdByName = await getUserNameByIdentifier(String(parsed.createdBy || ''))
      packageData = { ...parsed, createdByName }
      await redis.set(cacheKey, JSON.stringify(packageData), 'EX', REDIS_TTL)
    } else {
      packageData = parsed
    }
  } else {
    const dbPackage = await Package.findById(packageId).populate(packagePopulateConfig)

    if (!dbPackage) {
      return { status: 404, body: { message: 'Package not found' } }
    }

    const createdByName = await getUserNameByIdentifier(dbPackage.createdBy)
    packageData = {
      ...dbPackage.toObject(),
      createdByName,
    }

    await redis.set(cacheKey, JSON.stringify(packageData), 'EX', REDIS_TTL)
  }

  const packageStatusData = packageData as Pick<IPackage, 'approved' | 'status' | 'createdBy'>
  const isOwner = isPackageOwner(packageStatusData, userId)
  const isRevealed = Boolean(await UserPackageReveal.exists({ packageId, userId }))
  const canViewPackage = getPackageStatus(packageStatusData) === PACKAGE_STATUSES.approved || isOwner || isAdmin
  const canViewSensitive = isOwner || isAdmin || isRevealed

  if (!canViewPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const resolvedId = String(packageData._id || packageId)

  void Package.updateOne({ _id: resolvedId }, viewIncrement).catch((error) => {
    logger.error(`Failed to update package views for ${resolvedId}: ${error}`)
  })

  return {
    status: 200,
    body: {
      ...sanitizePackageForViewer(packageData, canViewSensitive),
      meta: {
        isRevealed,
        canViewSensitive,
      },
    },
  }
}

export const getDraftPackages = async (userId: string) => {
  const packages = await Package.find({
    createdBy: userId,
    status: { $in: [PACKAGE_STATUSES.draft, PACKAGE_STATUSES.rejected] },
  })
    .select('_id name destination coverImage status updatedAt rejectionReason')
    .sort({ updatedAt: -1 })
    .lean()

  return {
    message: 'Draft packages fetched successfully',
    data: packages,
  }
}

export const getPackageDetails = async (packageId: string, userId: string) => {
  const packageData = await Package.findById(packageId).populate(packagePopulateConfig)

  if (!packageData) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const { isAdmin, isOwner } = await canManagePackage(packageData, userId)
  const canView = getPackageStatus(packageData) === PACKAGE_STATUSES.approved || isOwner || isAdmin

  if (!canView) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  return {
    status: 200,
    body: {
      message: 'Package details fetched successfully',
      data: packageData,
    },
  }
}

export const getEditablePackage = async (packageId: string, userId: string) => {
  const packageData = await Package.findById(packageId).populate(packagePopulateConfig)

  if (!packageData) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const { isAdmin, isOwner } = await canManagePackage(packageData, userId)

  if (!isOwner && !isAdmin) {
    return { status: 403, body: { message: 'Forbidden: you cannot edit this package' } }
  }

  return {
    status: 200,
    body: {
      message: 'Editable package fetched successfully',
      data: packageData,
    },
  }
}

export const createPackageReview = async (data: CreateReviewInput, userId: string) => {
  const { packageId, review, rating } = data
  const existingPackage = await Package.findById(packageId)

  if (!existingPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  if (getPackageStatus(existingPackage) !== PACKAGE_STATUSES.approved) {
    return { status: 403, body: { message: 'Only approved packages can be reviewed' } }
  }

  const revealRecord = await UserPackageReveal.findOne({ packageId, userId }).select('createdAt').lean()
  const eligibility = buildReviewEligibility(revealRecord)

  if (!eligibility.revealed) {
    return { status: 403, body: { message: 'Unlock the trip before posting a review' } }
  }

  if (!eligibility.canReview) {
    return {
      status: 403,
      body: {
        message: 'Reviews unlock 3 days after unlocking',
        data: {
          reviewAvailableAt: eligibility.reviewAvailableAt?.toISOString() ?? null,
          daysRemaining: eligibility.daysRemaining,
        },
      },
    }
  }

  const createdReview = await PackageReview.create({ packageId, userId, review, rating })

  return {
    status: 201,
    body: {
      message: 'Package review created successfully',
      data: createdReview,
    },
  }
}

export const deletePackage = async (packageId: string, userId: string) => {
  const existingPackage = await Package.findById(packageId)

  if (!existingPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const { isAdmin, isOwner } = await canManagePackage(existingPackage, userId)

  if (!isOwner && !isAdmin) {
    return { status: 403, body: { message: 'Forbidden: you cannot delete this package' } }
  }

  if (getPackageStatus(existingPackage) === PACKAGE_STATUSES.approved && !isAdmin) {
    return { status: 403, body: { message: 'Approved packages can only be deleted by an admin' } }
  }

  const deletedPackage = await Package.findByIdAndDelete(packageId)

  if (!deletedPackage) {
    logger.info('Error while deleting the package')
    return { status: 404, body: { message: 'Package not found' } }
  }

  logger.info('Successfully deleted the package')

  if (isLocalPackageCoverImagePath(existingPackage.coverImage || '')) {
    deleteOldPackageCoverImage(existingPackage.coverImage)
  }

  await clearPackageCaches(packageId, existingPackage.createdBy)

  return { status: 200, body: { message: 'Package deleted successfully' } }
}

export const getPendingPackages = async (userId: string) => {
  const roleCheck = await checkAdminRole(userId)

  if (!roleCheck.ok) {
    return { status: roleCheck.status, body: { message: roleCheck.message } }
  }

  const packages = (await Package.find(pendingPackageQuery)
    .populate(packagePopulateConfig)
    .sort({ createdAt: -1 }))
    .map((packageData) => normalizePackageStatusForResponse(packageData))

  return { status: 200, body: packages }
}

export const approvePackage = async (packageId: string, reviewerId: string) => {
  const roleCheck = await checkAdminRole(reviewerId)

  if (!roleCheck.ok) {
    return { status: roleCheck.status, body: { message: roleCheck.message } }
  }

  const existingPackage = await Package.findById(packageId)

  if (!existingPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const currentStatus = getPackageStatus(existingPackage)

  if (currentStatus === PACKAGE_STATUSES.draft) {
    return { status: 400, body: { message: 'Draft packages must be submitted before approval' } }
  }

  if (currentStatus === PACKAGE_STATUSES.rejected) {
    return { status: 400, body: { message: 'Rejected packages must be resubmitted before approval' } }
  }

  const approvedPackage = await Package.findByIdAndUpdate(
    packageId,
    {
      approved: true,
      status: PACKAGE_STATUSES.approved,
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      rejectionReason: undefined,
    },
    { new: true, runValidators: true },
  ).populate(packagePopulateConfig)

  if (!approvedPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  await clearPackageCaches(packageId, existingPackage.createdBy)

  return {
    status: 200,
    body: {
      message: 'Package approved successfully',
      data: normalizePackageStatusForResponse(approvedPackage),
    },
  }
}

export const unapprovePackage = async (packageId: string, reviewerId: string) => {
  const roleCheck = await checkAdminRole(reviewerId)

  if (!roleCheck.ok) {
    return { status: roleCheck.status, body: { message: roleCheck.message } }
  }

  const existingPackage = await Package.findById(packageId)

  if (!existingPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const unapprovedPackage = await Package.findByIdAndUpdate(
    packageId,
    {
      approved: false,
      status: PACKAGE_STATUSES.pendingApproval,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      rejectionReason: undefined,
    },
    { new: true, runValidators: true },
  ).populate(packagePopulateConfig)

  if (!unapprovedPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  await clearPackageCaches(packageId, existingPackage.createdBy)

  return {
    status: 200,
    body: {
      message: 'Package moved back to pending approval successfully',
      data: normalizePackageStatusForResponse(unapprovedPackage),
    },
  }
}

export const rejectPackage = async (packageId: string, reviewerId: string, reason?: string) => {
  const roleCheck = await checkAdminRole(reviewerId)

  if (!roleCheck.ok) {
    return { status: roleCheck.status, body: { message: roleCheck.message } }
  }

  const existingPackage = await Package.findById(packageId)

  if (!existingPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  if (getPackageStatus(existingPackage) !== PACKAGE_STATUSES.pendingApproval) {
    return { status: 400, body: { message: 'Only pending packages can be rejected' } }
  }

  const rejectionReason = reason && reason.trim() ? reason.trim() : undefined

  const rejectedPackage = await Package.findByIdAndUpdate(
    packageId,
    {
      approved: false,
      status: PACKAGE_STATUSES.rejected,
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      rejectionReason,
    },
    { new: true, runValidators: true },
  ).populate(packagePopulateConfig)

  if (!rejectedPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  await clearPackageCaches(packageId, existingPackage.createdBy)

  return {
    status: 200,
    body: {
      message: 'Package rejected successfully',
      data: normalizePackageStatusForResponse(rejectedPackage),
    },
  }
}

export const revealPackage = async (packageId: string, userId: string) => {
  const existingPackage = await Package.findById(packageId)

  if (!existingPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  if (getPackageStatus(existingPackage) !== PACKAGE_STATUSES.approved) {
    return { status: 403, body: { message: 'Only approved packages can be revealed' } }
  }

  const alreadyRevealed = await UserPackageReveal.findOne({ packageId, userId })

  if (alreadyRevealed) {
    return {
      status: 200,
      body: {
        message: 'Package already revealed',
        data: normalizePackageStatusForResponse(existingPackage),
      },
    }
  }

  await UserPackageReveal.create({ packageId, userId })

  return {
    status: 200,
    body: {
      message: 'Package revealed successfully',
      data: normalizePackageStatusForResponse(existingPackage),
    },
  }
}

export const likePackage = async (packageId: string, userId: string) => {
  const existingPackage = await Package.findById(packageId)

  if (!existingPackage) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  if (getPackageStatus(existingPackage) !== PACKAGE_STATUSES.approved) {
    return { status: 403, body: { message: 'Only approved packages can be liked' } }
  }

  const alreadyLikedPackage = await LikedPackage.findOne({ packageId, userId })

  if (alreadyLikedPackage) {
    return {
      status: 200,
      body: {
        message: 'Package already liked',
        data: normalizePackageStatusForResponse(existingPackage),
        alreadyLiked: true,
      },
    }
  }

  await LikedPackage.create({ packageId, userId })

  return {
    status: 200,
    body: {
      message: 'Package liked successfully',
      data: normalizePackageStatusForResponse(existingPackage),
      alreadyLiked: false,
    },
  }
}

export const getFeaturedPackage = async () => {
  const cacheKey = 'packages:featured:best'
  const cached = await redis.get(cacheKey)

  if (cached) {
    logger.info('cache hit')
    return { status: 200, body: JSON.parse(cached) }
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthKey = getCurrentMonthKey()

  const approvedPackages = await Package.find({ approved: true }).lean()

  if (approvedPackages.length === 0) {
    return { status: 404, body: { message: 'No approved packages found' } }
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
    { $group: { _id: '$packageId', avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ])

  const likesLast7DayMap = new Map(likesLast7Days.map((item) => [String(item._id), Number(item.count || 0)]))
  const likesAllTimeMap = new Map(likesAllTime.map((item) => [String(item._id), Number(item.count || 0)]))
  const reviewMap = new Map(
    reviewsLast7Days.map((item) => [
      String(item._id),
      { avgRating: Number(item.avgRating || 0), reviewCount: Number(item.reviewCount || 0) },
    ]),
  )

  const packageMetrics = approvedPackages.map((pkg) => {
    const id = toIdString(pkg._id)
    const likes7d = likesLast7DayMap.get(id) || 0
    const reviewStats = reviewMap.get(id)

    return {
      packageDoc: pkg,
      id,
      monthlyViews: getMonthlyViewCount((pkg as { monthlyViews?: unknown }).monthlyViews, monthKey),
      likes7d,
      avgRating7d: reviewStats?.avgRating || 0,
      reviewCount7d: reviewStats?.reviewCount || 0,
      hasEngagement: likes7d > 0 || (reviewStats?.reviewCount || 0) > 0,
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
          { monthlyViews: maxMonthlyViews, likesLast7Days: maxLikes7d },
        ),
      }))
      .sort((a, b) => b.score - a.score)[0]
  }

  if (!selected) {
    selected = [...packageMetrics].sort((a, b) => (b.likes7d - a.likes7d) || (b.monthlyViews - a.monthlyViews))[0]
  }

  if (!selected || selected.id.length === 0) {
    return { status: 404, body: { message: 'No package available for featured slot' } }
  }

  const selectedLikesAllTime = likesAllTimeMap.get(selected.id) || 0

  if (selectedLikesAllTime === 0) {
    const fallbackByAllTimeLikes = [...packageMetrics].sort((a, b) => {
      const likeDiff = (likesAllTimeMap.get(b.id) || 0) - (likesAllTimeMap.get(a.id) || 0)
      return likeDiff !== 0 ? likeDiff : b.monthlyViews - a.monthlyViews
    })[0]

    if (fallbackByAllTimeLikes) {
      selected = fallbackByAllTimeLikes
    }
  }

  const featuredPackage = await Package.findById(selected.id).select(PUBLIC_PACKAGE_SAFE_SELECT)

  if (!featuredPackage) {
    return { status: 404, body: { message: 'Featured package not found' } }
  }

  const response = { message: 'Featured package fetched successfully', data: featuredPackage }

  await redis.set(cacheKey, JSON.stringify(response), 'EX', FEATURED_REDIS_TTL)
  logger.info('cache miss')

  return { status: 200, body: response }
}

export const discoverPackages = async (filters: {
  search?: string
  destination?: string
  season?: string
  minBudget?: number
  maxBudget?: number
  minDuration?: number
  maxDuration?: number
  tags?: string[]
  sortBy: string
  order: 'asc' | 'desc'
  page: number
  limit: number
}) => {
  const { search, destination, season, minBudget, maxBudget, minDuration, maxDuration, tags, sortBy, order, page, limit } = filters
  const query: Record<string, unknown> = { approved: true }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { destination: { $regex: search, $options: 'i' } },
    ]
  }

  if (destination) query.destination = { $regex: destination, $options: 'i' }
  if (season) query.season = { $regex: season, $options: 'i' }
  if (minBudget !== undefined || maxBudget !== undefined) {
    query.budget = { ...(minBudget !== undefined ? { $gte: minBudget } : {}), ...(maxBudget !== undefined ? { $lte: maxBudget } : {}) }
  }
  if (minDuration !== undefined || maxDuration !== undefined) {
    query.duration = { ...(minDuration !== undefined ? { $gte: minDuration } : {}), ...(maxDuration !== undefined ? { $lte: maxDuration } : {}) }
  }
  if (tags && tags.length > 0) query.tags = { $in: tags }

  const sortOrder = order === 'asc' ? 1 : -1
  const skip = (page - 1) * limit

  const [packages, total] = await Promise.all([
    Package.find(query).select(PUBLIC_PACKAGE_SAFE_SELECT).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    Package.countDocuments(query),
  ])

  return {
    message: 'Packages fetched successfully',
    data: packages,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export const getPackageReviews = async (packageId: string) => {
  const cacheKey = `package:${packageId}:reviews`
  const cached = await redis.get(cacheKey)

  if (cached) {
    logger.info('cache hit')
    return { status: 200, body: JSON.parse(cached) }
  }

  const existingPackage = await Package.findById(packageId)
  if (!existingPackage || getPackageStatus(existingPackage) !== PACKAGE_STATUSES.approved) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const reviews = await PackageReview.find({ packageId }).sort({ createdAt: -1 }).lean()
  const userIds = [...new Set(reviews.map((r) => String(r.userId || '')).filter((id) => id.length > 0))]
  const objectIdUserIds = userIds.filter(isObjectIdString)
  const userFilters: Array<Record<string, unknown>> = []

  if (objectIdUserIds.length > 0) userFilters.push({ _id: { $in: objectIdUserIds } })
  if (userIds.length > 0) userFilters.push({ firebaseId: { $in: userIds } })

  const users = userFilters.length > 0
    ? await User.find({ $or: userFilters }).select('_id firebaseId name profilePicture').lean()
    : []

  const userMap = new Map<string, { name?: string; profilePicture?: string }>()
  for (const user of users) {
    if (user.firebaseId) userMap.set(user.firebaseId, user)
    userMap.set(String(user._id), user)
  }

  const enrichedReviews = reviews.map((review) => {
    const reviewer = userMap.get(String(review.userId))
    return { ...review, userName: reviewer?.name ?? 'Anonymous', userPicture: reviewer?.profilePicture ?? '' }
  })

  const response = { message: 'Reviews fetched successfully', data: enrichedReviews }
  await redis.set(cacheKey, JSON.stringify(response), 'EX', REDIS_TTL)
  logger.info('cache miss')

  return { status: 200, body: response }
}

export const getLikedPackages = async (userId: string) => {
  const cacheKey = `packages:liked:${userId}`
  const cached = await redis.get(cacheKey)

  if (cached) {
    logger.info('cache hit')
    return JSON.parse(cached)
  }

  const likedRecords = await LikedPackage.find({ userId }).lean()
  const packageIds = [...new Set(likedRecords.map((record) => record.packageId).filter(Boolean))]
  const packages = packageIds.length > 0
    ? await Package.find({ _id: { $in: packageIds } })
        .select('_id name coverImage season budget destination duration startDate endDate')
        .sort({ updatedAt: -1 })
    : []

  const response = { data: packages }
  await redis.set(cacheKey, JSON.stringify(response), 'EX', REDIS_TTL)
  logger.info('cache miss')

  return response
}

export const getReviewEligibility = async (packageId: string, userId: string) => {
  const packageExists = await Package.exists({ _id: packageId })

  if (!packageExists) {
    return { status: 404, body: { message: 'Package not found' } }
  }

  const revealRecord = await UserPackageReveal.findOne({ packageId, userId }).select('createdAt').lean()
  const eligibility = buildReviewEligibility(revealRecord)

  return {
    status: 200,
    body: {
      message: 'Review eligibility fetched successfully',
      data: {
        revealed: eligibility.revealed,
        revealedAt: eligibility.revealedAt ? eligibility.revealedAt.toISOString() : null,
        canReview: eligibility.canReview,
        reviewAvailableAt: eligibility.reviewAvailableAt ? eligibility.reviewAvailableAt.toISOString() : null,
        daysRemaining: eligibility.daysRemaining,
        status: eligibility.status,
      },
    },
  }
}
