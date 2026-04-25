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

  if (!profileId) {
    return res.status(400).json({ message: 'Profile id is required' })
  }

  const allowedFields = ['name', 'email', 'password', 'gender', 'profilePicture', 'bio']
  const payload = req.body as Record<string, unknown>
  const updateData: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      updateData[field] = payload[field]
    }
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ message: 'No valid fields provided for update' })
  }

  try {
    const updatedProfile = await User.findByIdAndUpdate(profileId, updateData, {
      new: true,
      runValidators: true,
    }).select('-password')

    if (!updatedProfile) {
      return res.status(404).json({ message: 'Profile not found' })
    }

    return res.status(200).json({
      message: 'Profile updated successfully',
      data: updatedProfile,
    })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return res.status(409).json({ message: 'Email already exists' })
    }

    logger.error(`Error updating profile: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
