import { updateUserSchema, validateSchema } from '../utils/validSchema'

import { Request, Response } from 'express'

import logger from '../config/logger'

import User from '../models/User'
import { checkAdminRole } from '../utils/roleCheck'

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
    const profiles = await User.find({})

    return res.status(200).json(profiles)
  } catch (error) {
    logger.error(`Error fetching profiles: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch profiles' })
  }
}

const showProfile = async (req: Request, res: Response) => {
  logger.info(`showProfile endpoint called for id: ${req.params.id}`)

  const profileId = req.params.id

  const profile = await User.findById(profileId)
 
  res.status(200).json(profile)
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

export { getProfiles, showProfile, updateProfile, deleteProfile }
