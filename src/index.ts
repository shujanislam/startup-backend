import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import protectedRoutes from './routes/protected'
import authRoutes from './routes/auth.routes'
import { firebaseAuthMiddleware } from './middleware/firebaseAuth'

import connectDB from './config/db'

import logger from './config/logger'

import packageRoutes from './routes/package.routes'
import profileRoutes from './routes/profile.routes'

const app = express()

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
  }),
)
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ message: 'Backend is running' })
})

app.use('/v1/api', protectedRoutes)
app.use('/v1/api/auth', authRoutes)
app.use('/v1/api/packages/', firebaseAuthMiddleware, packageRoutes)
app.use('/v1/api/profile/', firebaseAuthMiddleware, profileRoutes)

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
