import mongoose from 'mongoose'

import logger from './logger'

const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables')
  }

  if (mongoose.connection.readyState === 1) {
    return
  }

  try {
    await mongoose.connect(mongoUri)
    logger.info('MongoDB connected successfully')
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

export default connectDB
