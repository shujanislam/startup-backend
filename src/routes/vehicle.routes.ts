import { Router } from 'express'
import { deleteVehicle, getVehicles, postVehicle, updateVehicle, viewVehicle } from '../controllers/vehicle.controllers'

const vehicleRoutes = Router()

vehicleRoutes.get('/get-vehicles', getVehicles)
vehicleRoutes.get('/view-vehicle/:id', viewVehicle)
vehicleRoutes.post('/post-vehicle', postVehicle)
vehicleRoutes.patch('/update-vehicle/:id', updateVehicle)
vehicleRoutes.delete('/delete-vehicle/:id', deleteVehicle)

export default vehicleRoutes
