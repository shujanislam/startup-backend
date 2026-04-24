import 'dotenv/config'

import express from 'express'

import connectDB from './config/db'

import logger from './config/logger'

import packageRoutes from './routes/package.routes'

import profileRoutes from './routes/profile.routes'

const app = express()

app.use(express.json())

app.use('/v1/api/', packageRoutes)

app.use('/v1/api/', profileRoutes)

const PORT = process.env.PORT || 8080

const startServer = async (): Promise<void> => {
  try {
    await connectDB()

    app.listen(PORT, () => {
      logger.info(`Server running on PORT: ${PORT}`)
    })
  } catch (error) {
    logger.error(`Server startup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

void startServer()
