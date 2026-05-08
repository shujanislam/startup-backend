import { Router } from 'express'

import { deleteHotel, postHotel, updateHotel } from '../../controllers/hotel.controllers'

const privateHotelRoutes = Router()

privateHotelRoutes.post('/post-hotel', postHotel)
privateHotelRoutes.patch('/update-hotel/:id', updateHotel)
privateHotelRoutes.delete('/delete-hotel/:id', deleteHotel)

export default privateHotelRoutes
