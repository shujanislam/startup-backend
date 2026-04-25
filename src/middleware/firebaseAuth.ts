import type { NextFunction, Request, Response } from 'express'
import { admin } from '../config/firebaseAdmin'
import type { AuthenticatedRequest } from '../types/auth'

export const firebaseAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authorizationHeader = req.headers.authorization

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized: missing Bearer token' })
    return
  }

  const idToken = authorizationHeader.slice('Bearer '.length).trim()

  if (!idToken) {
    res.status(401).json({ message: 'Unauthorized: empty token' })
    return
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken)

    const authReq = req as AuthenticatedRequest
    authReq.user = {
      uid: decodedToken.uid,
      token: decodedToken,
    }

    next()
  } catch {
    res.status(401).json({ message: 'Unauthorized: invalid or expired token' })
  }
}