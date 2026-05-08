import { Router } from 'express'

import { getHotels, viewHotel } from '../../controllers/hotel.controllers'

const publicHotelRoutes = Router()

publicHotelRoutes.get('/get-hotels', getHotels)
publicHotelRoutes.get('/view-hotel/:id', viewHotel)

export default publicHotelRoutes
