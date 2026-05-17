import multer from 'multer'
import { Request, Response, NextFunction } from 'express'

// Configure multer with memory storage (we'll upload to Firebase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    if (!allowedMimes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'))
    } else {
      cb(null, true)
    }
  },
})

// Middleware to handle multer errors
export const handleMulterError = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File is too large. Maximum size is 5MB.',
      })
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    })
  }

  if (err instanceof Error) {
    return res.status(400).json({
      success: false,
      message: err.message,
    })
  }

  next(err)
}

export default upload
