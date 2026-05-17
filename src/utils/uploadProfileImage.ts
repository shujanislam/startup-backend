import multer, { type FileFilterCallback } from 'multer'
import type { Express } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { type Request } from 'express'
import logger from '../config/logger'

// Ensure uploads directory exists
const uploadsDir = path.resolve(process.cwd(), 'uploads', 'profiles')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const userId = req.userId || 'unknown'
    const timestamp = Date.now()
    const ext = path.extname(file.originalname)
    const filename = `${userId}_profilePic_${timestamp}${ext}`
    cb(null, filename)
  },
})

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  if (!allowedMimes.includes(file.mimetype)) {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'))
  } else {
    cb(null, true)
  }
}

const uploadProfileImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter,
})

/**
 * Get the profile image filename from request
 */
export const getProfileImagePath = (req: Request): string | null => {
  if (!req.file) {
    return null
  }

  try {
    logger.info(`Profile image uploaded: ${req.file.filename}`)
    return req.file.filename
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Error processing profile image: ${errorMessage}`)
    return null
  }
}

/**
 * Delete old profile image file if it exists
 */
export const deleteOldProfileImage = (imagePath: string): void => {
  if (!imagePath) return

  try {
    const fullPath = path.resolve(uploadsDir, imagePath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
      logger.info(`Deleted old profile image: ${imagePath}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.warn(`Failed to delete old profile image: ${errorMessage}`)
    // Don't throw - deletion failures shouldn't block operations
  }
}

export default uploadProfileImage
