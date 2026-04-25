import fs from 'node:fs'
import path from 'node:path'
import { createLogger, format, transports } from 'winston'
import type { TransformableInfo } from 'logform'

const logsDir = path.join(process.cwd(), 'logs')

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf((info: TransformableInfo) => {
      const { timestamp, level, message, stack } = info as TransformableInfo & {
        timestamp?: string
        stack?: string
      }

      if (stack) {
        return `${timestamp} [${level}] ${message}\n${stack}`
      }

      return `${timestamp} [${level}] ${message}`
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new transports.File({ filename: path.join(logsDir, 'combined.log') }),
  ],
})

export default logger
