import { createUserSchema, updateUserSchema, validateSchema } from '../utils/validSchema';

import { Request, Response } from 'express';

import logger from '../config/logger'

import User from '../models/User'

const getProfiles = async (req: Request, res: Response) => {
  logger.info('getProfiles endpoint called')
  
  const profiles = await User.find({})

  logger.info(profiles)

  res.status(200).json({ message: 'getProfiles working' })
}

const showProfile = async (req: Request, res: Response) => {
  logger.info(`showProfile endpoint called for id: ${req.params.id}`)

  const profileId = req.params.id

  const profile = await User.find({ id: profileId })

  logger.info(profile)
  
  res.status(200).json({ message: 'showProfile working' })
}

const updateProfile = async (req: Request, res: Response) => {
  const profileId = req.params.id
  logger.info(`updateProfile endpoint called for id: ${profileId}`)

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
  
  const profileId = req.params.id

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
