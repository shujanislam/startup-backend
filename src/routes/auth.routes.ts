import { Router } from 'express'
import {
  getCurrentUser,
  loginUser,
  registerUser,
  syncFirebaseUser,
} from '../controllers/auth.controllers'
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth'

const authRoutes = Router()

authRoutes.use(firebaseAuthMiddleware)

authRoutes.post('/register', registerUser)
authRoutes.post('/login', loginUser)
authRoutes.post('/sync', syncFirebaseUser)
authRoutes.get('/me', getCurrentUser)

export default authRoutes