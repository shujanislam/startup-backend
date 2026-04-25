import { Request, Response } from 'express'

import logger from '../config/logger'

import Package from '../models/Package' 

import PackageReview from '../models/PackageReviews' 

import { createPackageSchema, validateSchema, updatePackageSchema, createReviewSchema, sortPackageSchema } from '../utils/validSchema'

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

const discoverPackage = async (req: Request, res: Response) => {
  logger.info('discoverPackage endpoint called')

  const validation = validateSchema(sortPackageSchema, req.query)

  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  const {
    search,
    destination,
    season,
    minBudget,
    maxBudget,
    minDuration,
    maxDuration,
    tags,
    sortBy,
    order,
    page,
    limit,
  } = validation.data

  try {
    const query: Record<string, unknown> = {}

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { destination: { $regex: search, $options: 'i' } },
      ]
    }

    if (destination) {
      query.destination = { $regex: destination, $options: 'i' }
    }

    if (season) {
      query.season = { $regex: season, $options: 'i' }
    }

    if (minBudget !== undefined || maxBudget !== undefined) {
      query.budget = {
        ...(minBudget !== undefined ? { $gte: minBudget } : {}),
        ...(maxBudget !== undefined ? { $lte: maxBudget } : {}),
      }
    }

    if (minDuration !== undefined || maxDuration !== undefined) {
      query.duration = {
        ...(minDuration !== undefined ? { $gte: minDuration } : {}),
        ...(maxDuration !== undefined ? { $lte: maxDuration } : {}),
      }
    }

    if (tags && tags.length > 0) {
      query.tags = { $in: tags }
    }

    const sortOrder = order === 'asc' ? 1 : -1
    const skip = (page - 1) * limit

    const [packages, total] = await Promise.all([
      Package.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      Package.countDocuments(query),
    ])

    return res.status(200).json({
      message: 'Packages fetched successfully',
      data: packages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error(`Error fetching packages: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch packages' })
  }
}

const postPackage = async (req: Request, res: Response) => {
  logger.info('postPackage endpoint called')

  const validation = validateSchema(createPackageSchema, req.body)

  if(!validation.success){
    return res.status(400).json({
      message: "Validation Failed",
      errors: validation.errors
    })
  }

  try{
    const createdPackage = await Package.create(validation.data)
    return res.status(201).json({
      message: "Package created successfully",
      data: createdPackage,
    })
  }catch(error){
    logger.error(`Error creating package: ${error}`)
    return res.status(500).json({ message: "Failed to create Package" })
  }
}

const updatePackage = async (req: Request, res: Response) => {
  const packageId = req.params.id
  logger.info(`updatePackage endpoint called for id: ${packageId || 'not provided'}`)

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

   // ✅ Add validation here!
  const validation = validateSchema(updatePackageSchema, req.body)
  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors
    })
  }

  if (Object.keys(validation.data).length === 0) {
    return res.status(400).json({ 
      message: 'No valid fields provided for update' 
    })
  }

  try {
    const updatedPackage = await Package.findByIdAndUpdate(
      packageId,
      validation.data,
      { new: true, runValidators: true }
    )

    if (!updatedPackage) {
      return res.status(404).json({ message: 'Package not found' })
    }

    return res.status(200).json({
      message: 'Package updated successfully',
      data: updatedPackage,
    })
  } catch (error) {
    logger.error(`Error updating package: ${error}`)
    return res.status(500).json({ message: 'Failed to update package' })
  }
}

const postPackageReview = async (req: Request, res: Response) => {
  logger.info('postPackageReview endpoint called')

  // ✅ Add validation here too!
  const validation = validateSchema(createReviewSchema, req.body)
  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors
    })
  }

  try {
    const { packageId, userId, review, rating } = validation.data

    const packageExists = await Package.exists({ _id: packageId })
    if (!packageExists) {
      return res.status(404).json({ message: 'Package not found' })
    }

    const createdReview = await PackageReview.create({
      packageId, userId, review, rating
    })

    return res.status(201).json({
      message: 'Package review created successfully',
      data: createdReview,
    })
  } catch (error) {
    logger.error(`Error creating package review: ${error}`)
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
