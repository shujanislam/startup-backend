import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import protectedRoutes from './routes/protected'

const app = express()

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
  }),
)
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ message: 'Backend is running' })
})

app.use('/api', protectedRoutes)

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log(`Server running on PORT: ${PORT}`)
})
