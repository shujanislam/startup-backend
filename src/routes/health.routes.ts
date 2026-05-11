import { Router } from 'express'

import mongoose from 'mongoose'

import redis from '../config/redis'

const router = Router()

router.get('/health', (_req, res) => {
  return res.status(200).json({
    status: 'ok',
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})

router.get('/health/ready', async (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1

  let redisOk = false

  try {
    const pong = await Promise.race([
      redis.ping(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 300)),
    ])

    redisOk = pong === 'PONG'
  } catch {
    redisOk = false
  }

  const ready = mongoOk && redisOk

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: {
      mongodb: mongoOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
    },
    timestamp: new Date().toISOString(),
  })
})

export default router
