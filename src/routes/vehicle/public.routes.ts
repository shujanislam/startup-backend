import { Router } from 'express'

import { getVehicles, viewVehicle } from '../../controllers/vehicle.controllers'

const publicVehicleRoutes = Router()

publicVehicleRoutes.get('/get-vehicles', getVehicles)
publicVehicleRoutes.get('/view-vehicle/:id', viewVehicle)

export default publicVehicleRoutes
