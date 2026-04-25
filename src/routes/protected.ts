import { Router } from 'express'
import { getCurrentUser } from '../controllers/auth.controllers'
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth'

const protectedRoutes = Router()

protectedRoutes.get('/me', firebaseAuthMiddleware, getCurrentUser)

export default protectedRoutes