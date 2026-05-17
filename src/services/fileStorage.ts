import { admin } from '../config/firebaseAdmin'
import logger from '../config/logger'

const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'startup-2c9aa.appspot.com'
const bucket = admin.storage().bucket(bucketName)

/**
 * Sanitizes filename by removing special characters
 */
const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

/**
 * Uploads an image to Firebase Cloud Storage
 * @param fileBuffer - The file buffer from multer
 * @param originalFilename - Original filename for reference
 * @param userId - User ID for organizing files
 * @param subfolder - Optional subfolder (e.g., 'packages', 'profiles')
 * @returns Public URL of the uploaded image
 */
export const uploadImageToFirebase = async (
  fileBuffer: Buffer,
  originalFilename: string,
  userId: string,
  subfolder: string = 'images'
): Promise<string> => {
  try {
    // Generate unique filename with timestamp and user ID
    const sanitized = sanitizeFilename(originalFilename)
    const timestamp = Date.now()
    const uniqueFilename = `${subfolder}/${userId}_${timestamp}_${sanitized}`

    // Create file reference
    const file = bucket.file(uniqueFilename)

    // Detect MIME type from original filename or use default
    let contentType = 'image/jpeg'
    if (originalFilename.toLowerCase().endsWith('.png')) {
      contentType = 'image/png'
    } else if (originalFilename.toLowerCase().endsWith('.gif')) {
      contentType = 'image/gif'
    } else if (originalFilename.toLowerCase().endsWith('.webp')) {
      contentType = 'image/webp'
    }

    // Upload file to Firebase Cloud Storage
    await file.save(fileBuffer, {
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
        metadata: {
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId,
        },
      },
    })

    // Generate public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFilename}`

    logger.info(`Image uploaded successfully: ${publicUrl}`)
    return publicUrl
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Failed to upload image to Firebase: ${errorMessage}`)
    throw new Error('Image upload failed. Please try again.')
  }
}

/**
 * Deletes an image from Firebase Cloud Storage
 * @param imageUrl - Public URL or filename of the image to delete
 */
export const deleteImageFromFirebase = async (imageUrl: string): Promise<void> => {
  try {
    // Extract filename from URL if full URL is provided
    let filename = imageUrl
    if (imageUrl.startsWith('https://')) {
      const parts = imageUrl.split('/')
      filename = parts.slice(4).join('/')
    }

    const file = bucket.file(filename)
    await file.delete()

    logger.info(`Image deleted successfully: ${filename}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.warn(`Failed to delete image from Firebase: ${errorMessage}`)
    // Don't throw - deletion failures shouldn't block operations
  }
}
