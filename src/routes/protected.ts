import { Router } from 'express'
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth'
import type { AuthenticatedRequest } from '../types/auth'

const protectedRoutes = Router()

protectedRoutes.get('/me', firebaseAuthMiddleware, (req, res) => {
  const authReq = req as AuthenticatedRequest

  if (!authReq.user) {
    res.status(401).json({ message: 'Unauthorized: user not found in request' })
    return
  }

  res.json({
    user: {
      uid: authReq.user.uid,
      email: authReq.user.token.email || null,
    },
  })
})

export default protectedRoutes