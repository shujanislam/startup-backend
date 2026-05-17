import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import path from 'node:path'
import protectedRoutes from './routes/protected'
import authRoutes from './routes/auth.routes'
import { firebaseAuthMiddleware } from './middleware/firebaseAuth'
import { attachCurrentUser } from './middleware/attachCurrentUser'

import connectDB from './config/db'

import logger from './config/logger'

import { publicRateLimit, privateRateLimit } from './middleware/rateLimit'

import publicPackageRoutes from './routes/package/public.routes'
import privatePackageRoutes from './routes/package/private.routes'
import publicProfileRoutes from './routes/profile/public.routes'
import privateProfileRoutes from './routes/profile/private.routes'
import publicHotelRoutes from './routes/hotel/public.routes'
import privateHotelRoutes from './routes/hotel/private.routes'
import publicVehicleRoutes from './routes/vehicle/public.routes'
import privateVehicleRoutes from './routes/vehicle/private.routes'
import healthRoutes from './routes/health.routes'

const app = express()

const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const devDefaultOrigins = ['http://localhost:5173', 'http://localhost:5175']
const FRONTEND_ORIGINS = Array.from(new Set([...configuredOrigins, ...devDefaultOrigins]))

app.use(
  cors({
    origin: FRONTEND_ORIGINS,
    credentials: true,
  }),
)
app.use(express.json())

// Serve uploaded images as static files
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))

app.get('/', (_req, res) => {
  res.json({ message: 'Backend is running' })
})

app.use('/', healthRoutes)
app.use('/v1/api', protectedRoutes)
app.use('/v1/api/auth', authRoutes)
app.use('/v1/api/packages', publicRateLimit, publicPackageRoutes)
app.use('/v1/api/packages', firebaseAuthMiddleware, attachCurrentUser, privateRateLimit, privatePackageRoutes)
app.use('/v1/api/profile', publicRateLimit, publicProfileRoutes)
app.use('/v1/api/profile', firebaseAuthMiddleware, attachCurrentUser, privateRateLimit, privateProfileRoutes)
app.use('/v1/api/hotels', publicRateLimit, publicHotelRoutes)
app.use('/v1/api/hotels', firebaseAuthMiddleware, attachCurrentUser, privateRateLimit, privateHotelRoutes)
app.use('/v1/api/vehicles', publicRateLimit, publicVehicleRoutes)
app.use('/v1/api/vehicles', firebaseAuthMiddleware, attachCurrentUser, privateRateLimit, privateVehicleRoutes)

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
