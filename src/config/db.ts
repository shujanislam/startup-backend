import mongoose from 'mongoose'

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
    console.log('MongoDB connected successfully')
  } catch (error) {
    console.error('MongoDB connection failed:', error)
    process.exit(1)
  }
}

export default connectDB
