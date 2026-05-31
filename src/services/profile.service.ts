import redis from '../config/redis'
import logger from '../config/logger'
import Package from '../models/Package'
import User from '../models/User'
import UserPackageReveal from '../models/UserPackageReveal'
import { checkAdminRole } from '../utils/roleCheck'
import { deleteOldProfileImage } from '../utils/uploadProfileImage'

const REDIS_TTL = 3600

export const getProfiles = async (requestUserId: string) => {
  const roleCheck = await checkAdminRole(requestUserId)

  if (!roleCheck.ok) {
    if (roleCheck.status === 500) {
      logger.error(`Admin role check failed for user ${requestUserId}: ${roleCheck.message}`)
    }

    return { status: roleCheck.status, body: { message: roleCheck.message } }
  }

  const cacheKey = 'profiles:list'
  const cached = await redis.get(cacheKey)

  if (cached) {
    logger.info('cache hit')
    return { status: 200, body: JSON.parse(cached) }
  }

  const profiles = await User.find({})

  await redis.set(cacheKey, JSON.stringify(profiles), 'EX', REDIS_TTL)
  logger.info('cache miss')

  return { status: 200, body: profiles }
}

export const showProfile = async (profileId: string, requestUserId?: string) => {
  const cacheKey = `profile:${profileId}`
  const cached = await redis.get(cacheKey)
  let profile

  if (cached) {
    logger.info('cache hit')
    profile = JSON.parse(cached)
  } else {
    profile = await User.findById(profileId)

    if (!profile) {
      return { status: 404, body: { message: 'Profile not found' } }
    }

    await redis.set(cacheKey, JSON.stringify(profile), 'EX', REDIS_TTL)
    logger.info('cache miss')
  }

  return {
    status: 200,
    body: {
      profile,
      ownProfile: requestUserId === profileId,
    },
  }
}

export const updateProfile = async (
  profileId: string,
  data: Record<string, unknown>,
  profileImagePath?: string | null,
) => {
  if (profileImagePath) {
    const currentUser = await User.findById(profileId)

    if (currentUser?.profileImagePath) {
      deleteOldProfileImage(currentUser.profileImagePath)
    }
  }

  const updatedProfile = await User.findByIdAndUpdate(
    profileId,
    {
      ...data,
      ...(profileImagePath && { profileImagePath }),
    },
    { new: true, runValidators: true },
  ).select('-password')

  if (!updatedProfile) {
    return { status: 404, body: { message: 'Profile not found' } }
  }

  logger.info(`Profile updated successfully for user ${profileId}`)

  await redis.del(`profile:${profileId}`)
  await redis.del('profiles:list')

  return {
    status: 200,
    body: {
      message: 'Profile updated successfully',
      data: updatedProfile,
    },
  }
}

export const deleteProfile = async (profileId: string) => {
  const deletedProfile = await User.findByIdAndDelete(profileId)

  if (!deletedProfile) {
    logger.info('Error while deleting profile')
    return { status: 404, body: { message: 'Profile not found' } }
  }

  logger.info('Profile deleted successfully')

  await redis.del(`profile:${profileId}`)
  await redis.del('profiles:list')
  await redis.del(`packages:created:${profileId}`)

  return { status: 200, body: { message: 'Profile deleted successfully' } }
}

export const getRevealedPackages = async (userId: string) => {
  const userExists = await User.exists({ _id: userId })

  if (!userExists) {
    return { status: 404, body: { message: 'User not found' } }
  }

  const revealRecords = await UserPackageReveal.find({ userId }).lean()

  if (revealRecords.length === 0) {
    return { status: 200, body: { message: 'No revealed packages found', data: [] } }
  }

  const packageIds = [
    ...new Set(
      revealRecords
        .map((record) => record.packageId)
        .filter((id): id is string => Boolean(id && id.trim())),
    ),
  ]

  if (packageIds.length === 0) {
    return { status: 200, body: { message: 'No valid revealed packages found', data: [] } }
  }

  const packages = await Package.find({ _id: { $in: packageIds } })
    .select('name coverImage destination budget duration season approved createdBy createdAt updatedAt')
    .sort({ updatedAt: -1 })

  return {
    status: 200,
    body: {
      message: 'User revealed packages fetched successfully',
      data: packages,
    },
  }
}

export const getCreatedPackages = async (userId: string) => {
  const cacheKey = `packages:created:${userId}`
  const cached = await redis.get(cacheKey)

  if (cached) {
    logger.info('cache hit')
    return { status: 200, body: JSON.parse(cached) }
  }

  const userExists = await User.findById(userId)

  if (!userExists) {
    return { status: 404, body: { message: 'User not found' } }
  }

  const createdPackages = await Package.find({ createdBy: userId })
    .select('_id name coverImage season budget destination duration startDate endDate')

  const response = { createdPackages }

  await redis.set(cacheKey, JSON.stringify(response), 'EX', REDIS_TTL)
  logger.info('cache miss')

  return { status: 200, body: response }
}
