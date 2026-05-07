import { updateUserSchema, validateSchema } from '../utils/validSchema';

import { Request, Response } from 'express';

import redis from '../config/redis'

import logger from '../config/logger'

import User from '../models/User'
import { checkAdminRole } from '../utils/roleCheck'

import UserPackageReveal from '../models/UserPackageReveal'

import Package from '../models/Package'

const REDIS_TTL = 3600

const getProfiles = async (req: Request, res: Response) => {
  logger.info('getProfiles endpoint called')

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const roleCheck = await checkAdminRole(req.userId)

  if (!roleCheck.ok) {
    if (roleCheck.status === 500) {
      logger.error(`Admin role check failed for user ${req.userId}: ${roleCheck.message}`)
    }
    return res.status(roleCheck.status).json({ message: roleCheck.message })
  }

  try {
    const REDIS_CACHE_KEY = 'profiles:list'

    const cached = await redis.get(REDIS_CACHE_KEY)

    if (cached) {
      logger.info('cache hit')
      return res.status(200).json(JSON.parse(cached))
    }

    const profiles = await User.find({})

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(profiles), 'EX', REDIS_TTL)

    logger.info('cache miss')

    return res.status(200).json(profiles)
  } catch (error) {
    logger.error(`Error fetching profiles: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch profiles' })
  }
}

const showProfile = async (req: Request, res: Response) => {
  const REDIS_CACHE_KEY = `profile:${req.params.id}`

  try {
    const cached = await redis.get(REDIS_CACHE_KEY)

    if (cached) {
      logger.info('cache hit')
      return res.status(200).json(JSON.parse(cached))
    }

    const profileId = req.params.id

    const profile = await User.findById(profileId)

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' })
    }

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(profile), 'EX', REDIS_TTL)

    logger.info('cache miss')
    return res.status(200).json(profile)
  } catch (error) {
    logger.error(`Error fetching profile ${req.params.id}: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch profile' })
  }
}

const updateProfile = async (req: Request, res: Response) => {
  const profileId = req.params.id

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (profileId !== req.userId) {
    return res.status(403).json({ message: 'Forbidden: you can update only your profile' })
  }

  const validation = validateSchema(updateUserSchema, req.body);
  
  if (!validation.success) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: validation.errors
        })
    }

    try {
        const updatedProfile = await User.findByIdAndUpdate(
            req.params.id,
            validation.data,
            { new: true, runValidators: true }
        ).select('-password')

        if (!updatedProfile) {
            return res.status(404).json({ message: 'Profile not found' })
        }

        return res.status(200).json({
            message: 'Profile updated successfully',
            data: updatedProfile,
        })
    } catch (error) {
        logger.error(`Error updating profile: ${error}`)
        return res.status(500).json({ message: 'Failed to update profile' })
    }
}

const deleteProfile = async (req: Request, res: Response) => {
  logger.info(`deleteProfile endpoint called for id: ${req.params.id}`)

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  
  const profileId = req.params.id

  if (profileId !== req.userId) {
    return res.status(403).json({ message: 'Forbidden: you can delete only your profile' })
  }

  const deletedProfile = await User.findByIdAndDelete(profileId)

  if(!deletedProfile){
    logger.info('Error while deleting profile')
  }
  else {
    logger.info('Profile deleted successfully')
  }

  res.status(200).json({ message: 'deleteProfile working' })
}

const getRevealedPackages = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const userExists = await User.exists({ _id: req.userId })

    if (!userExists) {
      return res.status(404).json({ message: 'User not found' })
    }

    const revealRecords = await UserPackageReveal.find({ userId: req.userId }).lean()

    if (revealRecords.length === 0) {
      return res.status(200).json({
        message: 'No revealed packages found',
        data: [],
      })
    }

    const packageIds = [
      ...new Set(
        revealRecords
          .map((record) => record.packageId)
          .filter((id): id is string => Boolean(id && id.trim()))
      ),
    ]

    if (packageIds.length === 0) {
      return res.status(200).json({
        message: 'No valid revealed packages found',
        data: [],
      })
    }

    const packages = await Package.find({ _id: { $in: packageIds } })
      .select('name coverImage destination budget duration season approved createdBy createdAt updatedAt')
      .sort({ updatedAt: -1 })

    const foundPackageIdSet = new Set(packages.map((pkg) => pkg._id.toString()))
    const missingPackageIds = packageIds.filter((id) => !foundPackageIdSet.has(id))

    return res.status(200).json({
      message: 'User revealed packages fetched successfully',
      data: packages,
    })
  } catch (error) {
    logger.error(`Error fetching revealed packages: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch revealed packages' })
  }
}

const getCreatedPackages = async(req: Request, res: Response) => {
  if(!req.userId) return res.status(401).json({ message: 'Unauthorized' })

  try{
    const userId = req.userId

    const REDIS_CACHE_KEY = `packages:created:${userId}`

    const cached = await redis.get(REDIS_CACHE_KEY)

    if (cached) {
      logger.info('cache hit')
      return res.status(200).json(JSON.parse(cached))
    }

    const userExists = await User.findById(userId)

    if(!userExists) return res.status(404).json({ message: 'User not found' })

    const createdPackages = await Package.find({ createdBy: userId })

    const response = { createdPackages }

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(response), 'EX', REDIS_TTL)

    logger.info('cache miss')
    return res.status(200).json(response)
  }
  catch(err: any){
    logger.error(err.message)
    return res.status(500).json({ message: 'Failed to fetch created packages' })
  }
}

export {
  getProfiles,
  showProfile,
  updateProfile,
  deleteProfile,
  getRevealedPackages,
  getCreatedPackages,
}
