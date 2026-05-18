import { Request, Response } from 'express'
import logger from '../config/logger'
import {
  deleteOldPackageCoverImage,
  getPackageCoverImagePath,
} from '../utils/uploadPackageCoverImage'
import { deleteOldHotelPhoto, getHotelPhotoPath } from '../utils/uploadHotelPhoto'

/**
 * Upload cover image for package
 */
export const uploadCoverImage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    if (!req.file) {
      res.status(400).json({ message: 'No image file provided' })
      return
    }

    const imagePath = getPackageCoverImagePath(req)

    if (!imagePath) {
      res.status(400).json({ message: 'Failed to process image upload' })
      return
    }

    const previousCoverImage =
      typeof req.body?.previousCoverImage === 'string' ? req.body.previousCoverImage.trim() : ''

    if (previousCoverImage && previousCoverImage !== imagePath) {
      deleteOldPackageCoverImage(previousCoverImage)
    }

    logger.info(`Cover image uploaded for user ${req.userId}`)
    res.status(200).json({
      success: true,
      data: {
        imagePath,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload image'
    logger.error(`Cover image upload failed for user ${req.userId}: ${errorMessage}`)

    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to upload image. Please try again.',
    })
  }
}

/**
 * Upload photo for hotel
 */
export const uploadHotelPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    if (!req.file) {
      res.status(400).json({ message: 'No image file provided' })
      return
    }

    const imagePath = getHotelPhotoPath(req)

    if (!imagePath) {
      res.status(400).json({ message: 'Failed to process image upload' })
      return
    }

    const previousHotelPhoto =
      typeof req.body?.previousHotelPhoto === 'string' ? req.body.previousHotelPhoto.trim() : ''

    if (previousHotelPhoto && previousHotelPhoto !== imagePath) {
      deleteOldHotelPhoto(previousHotelPhoto)
    }

    logger.info(`Hotel photo uploaded for user ${req.userId}`)
    res.status(200).json({
      success: true,
      data: {
        imagePath,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload image'
    logger.error(`Hotel photo upload failed for user ${req.userId}: ${errorMessage}`)

    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to upload image. Please try again.',
    })
  }
}
