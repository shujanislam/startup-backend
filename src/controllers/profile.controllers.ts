import { updateUserSchema, validateSchema } from '../utils/validSchema'

import { Request, Response } from 'express'

import logger from '../config/logger'

import { getProfileImagePath } from '../utils/uploadProfileImage'
import * as profileService from '../services/profile.service'

const getProfiles = async (req: Request, res: Response) => {
  logger.info('getProfiles endpoint called')

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const result = await profileService.getProfiles(req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error fetching profiles: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch profiles' })
  }
}

const showProfile = async (req: Request, res: Response) => {
  const profileId = String(req.params.id || '')
  
  try {
    const result = await profileService.showProfile(profileId, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error fetching profile ${profileId}: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch profile' })
  }
}

const updateProfile = async (req: Request, res: Response) => {
  const profileId = String(req.params.id || '')

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (profileId !== req.userId) {
    return res.status(403).json({ message: 'Forbidden: you can update only your profile' })
  }

  try {
    let profileImagePath: string | null = null

    if (req.file) {
      profileImagePath = getProfileImagePath(req)
      
      if (!profileImagePath) {
        return res.status(400).json({ message: 'Failed to process image upload' })
      }
    }

    const updateData = {
      ...req.body,
      ...(profileImagePath && { profileImagePath }),
    }

    const validation = validateSchema(updateUserSchema, updateData)

    if (!validation.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.errors,
      })
    }

    const result = await profileService.updateProfile(profileId, validation.data, profileImagePath)
    return res.status(result.status).json(result.body)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Error updating profile: ${errorMessage}`)
    return res.status(500).json({ message: 'Failed to update profile' })
  }
}

const deleteProfile = async (req: Request, res: Response) => {
  logger.info(`deleteProfile endpoint called for id: ${req.params.id}`)

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  
  const profileId = String(req.params.id || '')

  if (profileId !== req.userId) {
    return res.status(403).json({ message: 'Forbidden: you can delete only your profile' })
  }

  try {
    const result = await profileService.deleteProfile(profileId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error deleting profile: ${error}`)
    return res.status(500).json({ message: 'Failed to delete profile' })
  }
}

const getRevealedPackages = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const result = await profileService.getRevealedPackages(req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error fetching revealed packages: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch revealed packages' })
  }
}

const getCreatedPackages = async(req: Request, res: Response) => {
  if(!req.userId) return res.status(401).json({ message: 'Unauthorized' })

  try{
    const result = await profileService.getCreatedPackages(req.userId)
    return res.status(result.status).json(result.body)
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
