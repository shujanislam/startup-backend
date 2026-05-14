import { Request, Response, NextFunction } from 'express'

import redis from '../config/redis'

import logger from '../config/logger'

import User from '../models/User'

const REDIS_TTL = 3600

export const optionalAttachCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user?.uid) {
    return next()
  }

  const REDIS_CACHE_KEY = `current_user:${req.user.uid}`

  try {
    const cachedUserId = await redis.get(REDIS_CACHE_KEY)

    if (cachedUserId) {
      req.userId = JSON.parse(cachedUserId)
      return next()
    }

    const user = await User.findOne({ firebaseId: req.user.uid }).select('_id firebaseId email')

    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }

    req.userId = user._id.toString()
    req.userDoc = user

    await redis.set(REDIS_CACHE_KEY, JSON.stringify(req.userId), 'EX', REDIS_TTL)

    return next()
  } catch (error) {
    logger.error(`optionalAttachCurrentUser failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return res.status(500).json({ message: 'Failed to attach current user' })
  }
}
