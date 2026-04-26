import type { Request, Response } from 'express'
import Hotel from '../models/Hotel'
import Package from '../models/Package'
import logger from '../config/logger'
import { createHotelSchema, updateHotelSchema, validateSchema } from '../utils/validSchema'

const getHotels = async (_req: Request, res: Response) => {
  try {
    const hotels = await Hotel.find({})
    return res.status(200).json(hotels)
  } catch (error) {
    logger.error(`Error fetching hotels: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch hotels' })
  }
}

const viewHotel = async (req: Request, res: Response) => {
  try {
    const hotel = await Hotel.findById(req.params.id)

    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found' })
    }

    return res.status(200).json(hotel)
  } catch (error) {
    logger.error(`Error fetching hotel: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch hotel' })
  }
}

const postHotel = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const validation = validateSchema(createHotelSchema, req.body)

  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  try {
    const createdHotel = await Hotel.create({
      ...validation.data,
      createdBy: req.userId,
    })

    return res.status(201).json({
      message: 'Hotel created successfully',
      data: createdHotel,
    })
  } catch (error) {
    logger.error(`Error creating hotel: ${error}`)
    return res.status(500).json({ message: 'Failed to create hotel' })
  }
}

const updateHotel = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const validation = validateSchema(updateHotelSchema, req.body)

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
    const existingHotel = await Hotel.findById(req.params.id)

    if (!existingHotel) {
      return res.status(404).json({ message: 'Hotel not found' })
    }

    if (existingHotel.createdBy !== req.userId) {
      return res.status(403).json({ message: 'Forbidden: you cannot update this hotel' })
    }

    const updatedHotel = await Hotel.findByIdAndUpdate(
      req.params.id,
      {
        ...validation.data,
        createdBy: req.userId,
      },
      {
      new: true,
      runValidators: true,
      }
    )

    if (!updatedHotel) {
      return res.status(404).json({ message: 'Hotel not found' })
    }

    return res.status(200).json({
      message: 'Hotel updated successfully',
      data: updatedHotel,
    })
  } catch (error) {
    logger.error(`Error updating hotel: ${error}`)
    return res.status(500).json({ message: 'Failed to update hotel' })
  }
}

const deleteHotel = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const existingHotel = await Hotel.findById(req.params.id)

    if (!existingHotel) {
      return res.status(404).json({ message: 'Hotel not found' })
    }

    if (existingHotel.createdBy !== req.userId) {
      return res.status(403).json({ message: 'Forbidden: you cannot delete this hotel' })
    }

    const deletedHotel = await Hotel.findByIdAndDelete(req.params.id)

    if (!deletedHotel) {
      return res.status(404).json({ message: 'Hotel not found' })
    }

    await Package.updateMany(
      { hotels: deletedHotel._id },
      { $pull: { hotels: deletedHotel._id } }
    )

    return res.status(200).json({ message: 'Hotel deleted successfully' })
  } catch (error) {
    logger.error(`Error deleting hotel: ${error}`)
    return res.status(500).json({ message: 'Failed to delete hotel' })
  }
}

export { getHotels, viewHotel, postHotel, updateHotel, deleteHotel }
