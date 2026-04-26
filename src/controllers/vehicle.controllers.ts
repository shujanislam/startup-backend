import type { Request, Response } from 'express'
import Vehicle from '../models/Vehicle'
import logger from '../config/logger'
import { createVehicleSchema, updateVehicleSchema, validateSchema } from '../utils/validSchema'

const getVehicles = async (_req: Request, res: Response) => {
  try {
    const vehicles = await Vehicle.find({})
    return res.status(200).json(vehicles)
  } catch (error) {
    logger.error(`Error fetching vehicles: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch vehicles' })
  }
}

const viewVehicle = async (req: Request, res: Response) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }

    return res.status(200).json(vehicle)
  } catch (error) {
    logger.error(`Error fetching vehicle: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch vehicle' })
  }
}

const postVehicle = async (req: Request, res: Response) => {
  const validation = validateSchema(createVehicleSchema, req.body)

  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  try {
    const createdVehicle = await Vehicle.create(validation.data)
    return res.status(201).json({
      message: 'Vehicle created successfully',
      data: createdVehicle,
    })
  } catch (error) {
    logger.error(`Error creating vehicle: ${error}`)
    return res.status(500).json({ message: 'Failed to create vehicle' })
  }
}

const updateVehicle = async (req: Request, res: Response) => {
  const validation = validateSchema(updateVehicleSchema, req.body)

  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  if (Object.keys(validation.data).length === 0) {
    return res.status(400).json({ message: 'No valid fields provided for update' })
  }

  try {
    const updatedVehicle = await Vehicle.findByIdAndUpdate(req.params.id, validation.data, {
      new: true,
      runValidators: true,
    })

    if (!updatedVehicle) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }

    return res.status(200).json({
      message: 'Vehicle updated successfully',
      data: updatedVehicle,
    })
  } catch (error) {
    logger.error(`Error updating vehicle: ${error}`)
    return res.status(500).json({ message: 'Failed to update vehicle' })
  }
}

const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const deletedVehicle = await Vehicle.findByIdAndDelete(req.params.id)

    if (!deletedVehicle) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }

    return res.status(200).json({ message: 'Vehicle deleted successfully' })
  } catch (error) {
    logger.error(`Error deleting vehicle: ${error}`)
    return res.status(500).json({ message: 'Failed to delete vehicle' })
  }
}

export { getVehicles, viewVehicle, postVehicle, updateVehicle, deleteVehicle }
