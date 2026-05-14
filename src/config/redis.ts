import Redis from 'ioredis'

import logger from './logger'

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
      connectTimeout: 5000,
      enableOfflineQueue: true,
      retryStrategy(times){
        return Math.min(times * 100, 3000)  
      }
    })
  : new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
      maxRetriesPerRequest: null,
      lazyConnect: false,
      connectTimeout: 5000,
      enableOfflineQueue: true,
      retryStrategy(times){
        return Math.min(times * 100, 3000)  
      }
    })

redis.on('ready', () => {
  logger.info('Redis connected successfully')
})

redis.on('error', (error: Error) => {
  logger.error(`Redis connection error: ${error.message}`)
})

export const closeRedisConnection = async (): Promise<void> => {
  await redis.quit()
}

export default redis
