import { Router } from 'express'
import {
  getCurrentUser,
  loginUser,
  registerUser,
  syncFirebaseUser,
} from '../controllers/auth.controllers'
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth'

const authRoutes = Router()

// Register does NOT require Firebase auth — the backend creates the Firebase user
authRoutes.post('/register', registerUser)

// All other routes require an authenticated Firebase user
authRoutes.post('/login', firebaseAuthMiddleware, loginUser)
authRoutes.post('/sync', firebaseAuthMiddleware, syncFirebaseUser)
authRoutes.get('/me', firebaseAuthMiddleware, getCurrentUser)

export default authRoutes