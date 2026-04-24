import express from 'express'

import connectDB from './config/db'

import packageRoutes from './routes/package.routes'

import profileRoutes from './routes/profile.routes'

const app = express()

app.use(express.json())

app.use('/v1/api/', packageRoutes)

app.use('/v1/api/', profileRoutes)

const PORT = process.env.PORT || 8080

const startServer = async (): Promise<void> => {
  await connectDB()

  app.listen(PORT, () => {
    console.log(`Server running on PORT: ${PORT}`)
  })
}

void startServer()
