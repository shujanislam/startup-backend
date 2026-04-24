import express from 'express'

import packageRoutes from './routes/package.routes'

const app = express()

app.use('/v1/api/', packageRoutes)

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log(`Server running on PORT: ${PORT}`)
})
