import { Router } from 'express'

import { deleteVehicle, postVehicle, updateVehicle } from '../../controllers/vehicle.controllers'

const privateVehicleRoutes = Router()

privateVehicleRoutes.post('/post-vehicle', postVehicle)
privateVehicleRoutes.patch('/update-vehicle/:id', updateVehicle)
privateVehicleRoutes.delete('/delete-vehicle/:id', deleteVehicle)

export default privateVehicleRoutes
