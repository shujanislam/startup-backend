import multer, { type FileFilterCallback } from 'multer'
import type { Express, Request } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import logger from '../config/logger'

const uploadsDir = path.resolve(process.cwd(), 'uploads', 'hotels')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const userId = req.userId || 'unknown'
    const timestamp = Date.now()
    const ext = path.extname(file.originalname)
    const filename = `${userId}_hotelPhoto_${timestamp}${ext}`
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

const uploadHotelPhoto = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
})

export const getHotelPhotoPath = (req: Request): string | null => {
  if (!req.file) {
    return null
  }

  try {
    logger.info(`Hotel photo uploaded: ${req.file.filename}`)
    return req.file.filename
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Error processing hotel photo: ${errorMessage}`)
    return null
  }
}

export const isLocalHotelPhotoPath = (value: string): boolean => {
  if (!value) {
    return false
  }

  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    return false
  }

  return value.includes('_hotelPhoto_')
}

export const deleteOldHotelPhoto = (imagePath: string): void => {
  if (!isLocalHotelPhotoPath(imagePath)) {
    return
  }

  try {
    const fullPath = path.resolve(uploadsDir, imagePath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
      logger.info(`Deleted old hotel photo: ${imagePath}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.warn(`Failed to delete old hotel photo: ${errorMessage}`)
  }
}

export default uploadHotelPhoto
