import multer, { type FileFilterCallback } from 'multer'
import type { Express, Request } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import logger from '../config/logger'

const uploadsDir = path.resolve(process.cwd(), 'uploads', 'packages')
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
    const filename = `${userId}_packageCover_${timestamp}${ext}`
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

const uploadPackageCoverImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
})

export const getPackageCoverImagePath = (req: Request): string | null => {
  if (!req.file) {
    return null
  }

  try {
    logger.info(`Package cover image uploaded: ${req.file.filename}`)
    return req.file.filename
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Error processing package cover image: ${errorMessage}`)
    return null
  }
}

export const isLocalPackageCoverImagePath = (value: string): boolean => {
  if (!value) {
    return false
  }

  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    return false
  }

  return value.includes('_packageCover_')
}

export const deleteOldPackageCoverImage = (imagePath: string): void => {
  if (!isLocalPackageCoverImagePath(imagePath)) {
    return
  }

  try {
    const fullPath = path.resolve(uploadsDir, imagePath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
      logger.info(`Deleted old package cover image: ${imagePath}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.warn(`Failed to delete old package cover image: ${errorMessage}`)
  }
}

export default uploadPackageCoverImage
