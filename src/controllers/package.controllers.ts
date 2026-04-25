import { Request, Response } from 'express'

import logger from '../config/logger'

import Package from '../models/Package' 

import PackageReview from '../models/PackageReviews' 

const getPackages = async (req: Request, res: Response) => {
  const packages = await Package.find({})

  logger.info(packages)

  res.status(200).json({ message: 'getPackages working' })
}

const viewPackage = async (req: Request, res: Response) => { 
  const packageId = req.params.id 

  const packageData = await Package.findById(packageId)

  logger.info(packageData)

  res.status(200).json({ message: 'viewPackage working' })
}

const discoverPackage = (req: Request, res: Response) => {
  logger.info(`discoverPackage endpoint called for id: ${req.params.id || 'not provided'}`)
  res.status(200).json({ message: 'viewPackage working' })
}

const postPackage = async (req: Request, res: Response) => {
  logger.info('postPackage endpoint called')

  try {
    const {
      name,
      description,
      coverImage,
      season,
      budget,
      destination,
      spots,
      duration,
      startDate,
      endDate,
      identification,
      permit,
      tags,
      affiliateLinks,
      additional,
      createdBy,
      hotels,
      vehicles,
    } = req.body

    const requiredFields = [
      'name',
      'description',
      'coverImage',
      'season',
      'budget',
      'destination',
      'spots',
      'duration',
      'startDate',
      'endDate',
      'permit',
      'createdBy',
    ]

    const missingFields = requiredFields.filter((field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === '')

    if (missingFields.length > 0) {
      logger.warn(`postPackage validation failed. Missing fields: ${missingFields.join(', ')}`)
      return res.status(400).json({
        message: 'Missing required fields',
        missingFields,
      })
    }

    const createdPackage = await Package.create({
      name,
      description,
      coverImage,
      season,
      budget,
      destination,
      spots: Array.isArray(spots) ? spots : [],
      duration,
      startDate,
      endDate,
      identification: identification ?? false,
      permit,
      tags: Array.isArray(tags) ? tags : [],
      affiliateLinks: Array.isArray(affiliateLinks) ? affiliateLinks : [],
      additional,
      createdBy,
      hotels: Array.isArray(hotels) ? hotels : [],
      vehicles: Array.isArray(vehicles) ? vehicles : [],
    })

    return res.status(201).json({
      message: 'Package created successfully',
      data: createdPackage,
    })
  } catch (error) {
    logger.error(`Error creating package: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return res.status(500).json({ message: 'Failed to create package' })
  }
}

const updatePackage = async (req: Request, res: Response) => {
  const packageId = req.params.id
  logger.info(`updatePackage endpoint called for id: ${packageId || 'not provided'}`)

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  const allowedFields = [
    'name',
    'description',
    'coverImage',
    'season',
    'budget',
    'destination',
    'spots',
    'duration',
    'startDate',
    'endDate',
    'identification',
    'permit',
    'tags',
    'affiliateLinks',
    'additional',
    'createdBy',
    'hotels',
    'vehicles',
  ]

  const payload = req.body as Record<string, unknown>
  const updateData: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      updateData[field] = payload[field]
    }
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ message: 'No valid fields provided for update' })
  }

  try {
    const updatedPackage = await Package.findByIdAndUpdate(packageId, updateData, {
      new: true,
      runValidators: true,
    })

    if (!updatedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    return res.status(200).json({
      message: 'Package updated successfully',
      data: updatedPackage,
    })
  } catch (error) {
    logger.error(`Error updating package: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return res.status(500).json({ message: 'Failed to update package' })
  }
}

const postPackageReview = async (req: Request, res: Response) => {
  logger.info('postPackageReview endpoint called')

  try {
    const { packageId, userId, review, rating } = req.body

    const missingFields = ['packageId', 'userId', 'review', 'rating'].filter(
      (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === ''
    )

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        missingFields,
      })
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be a number between 1 and 5' })
    }

    const packageExists = await Package.exists({ _id: packageId })

    if (!packageExists) {
      return res.status(404).json({ message: 'Package not found for review' })
    }

    const createdReview = await PackageReview.create({
      packageId,
      userId,
      review,
      rating,
    })

    return res.status(201).json({
      message: 'Package review created successfully',
      data: createdReview,
    })
  } catch (error) {
    logger.error(`Error creating package review: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return res.status(500).json({ message: 'Failed to create package review' })
  }
}

const deletePackage = async (req: Request, res: Response) => {
  logger.info(`deletePackage endpoint called for id: ${req.params.id || 'not provided'}`)
  
  const packageId = req.params.id

  const deletedPackage = await Package.findByIdAndDelete(packageId)

  if(!deletedPackage){
    logger.info('Error while deleting the package')
  }
  else{
    logger.info('Successfully deleted the package')
  }

  res.status(200).json({ message: 'deletePackage working' })
}

export { getPackages, viewPackage, discoverPackage, postPackage, updatePackage, postPackageReview, deletePackage }
