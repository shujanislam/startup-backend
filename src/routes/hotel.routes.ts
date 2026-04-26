import { Router } from 'express'
import { deleteHotel, getHotels, postHotel, updateHotel, viewHotel } from '../controllers/hotel.controllers'

const hotelRoutes = Router()

hotelRoutes.get('/get-hotels', getHotels)
hotelRoutes.get('/view-hotel/:id', viewHotel)
hotelRoutes.post('/post-hotel', postHotel)
hotelRoutes.patch('/update-hotel/:id', updateHotel)
hotelRoutes.delete('/delete-hotel/:id', deleteHotel)

export default hotelRoutes
