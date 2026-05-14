import { Request, Response, NextFunction } from 'express'

import redis from '../config/redis'

import logger from '../config/logger'

const WINDOW_SEC = 60

const MAX_PUBLIC = 120

const MAX_PRIVATE = 240

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for']

  if(typeof forwarded === 'string' && forwarded.length > 0){
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown'
  }

  return req.ip || 'unknown'
}

export const publicRateLimit = async(req: Request, res: Response, next: NextFunction) => {
  const REDIS_KEY = `rl:public:${getClientIp(req)}`

  try{
    const count = await redis.incr(REDIS_KEY)

    if(count === 1) await redis.expire(REDIS_KEY, WINDOW_SEC)

    if(count > MAX_PUBLIC) {
      return res.status(429).json({ message: 'Too many requests. Try again later' })
    }

    return next()
  }
  catch(err: any){
    logger.error('Public Rate limit error')

    return next()
  }
}

export const privateRateLimit = async(req: Request, res: Response, next: NextFunction) => {
  const id = req.userId ? `${req.userId}` : `${getClientIp(req)}`

  const REDIS_KEY = `rl:private:${id}`

  try{
    const count = await redis.incr(REDIS_KEY)

    if(count === 1) await redis.expire(REDIS_KEY, WINDOW_SEC)

    if(count > MAX_PRIVATE) {
      return res.status(429).json({ message: 'Too many requests. Try again later' })
    }

    return next()
  }
  catch(err: any){
    logger.error('Private rate limit error')

    return next()
  }
}
