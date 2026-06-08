import { Request, Response, NextFunction } from 'express'

import redis from '../config/redis'

import logger from '../config/logger'

import { ensureUserForFirebaseToken } from '../services/auth.service'

const REDIS_TTL = 3600

export const attachCurrentUser = async(req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.uid) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const REDIS_CACHE_KEY = `current_user:${req.user.uid}`

  try {
    const cachedUserId = await redis.get(REDIS_CACHE_KEY)

    if (cachedUserId) {
      req.userId = JSON.parse(cachedUserId)
      return next()
    }

    const user = await ensureUserForFirebaseToken(req.user.uid, req.user.token)

    req.userId = user._id.toString()
    req.userDoc = user

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(req.userId), 'EX', REDIS_TTL)

    return next()
  } catch (error) {
    logger.error(`attachCurrentUser failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return res.status(500).json({ message: 'Failed to attach current user' })
  }
}
