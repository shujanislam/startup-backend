import { Request, Response } from 'express'

import logger from '../config/logger'

import {
  createPackageSchema,
  draftPackageSchema,
  validateSchema,
  updatePackageSchema,
  createReviewSchema,
  sortPackageSchema,
} from '../utils/validSchema'

import * as packageService from '../services/package.service'

const getPackages = async (req: Request, res: Response) => {
  const page: number = Number(req.query.page) || 0

  try {
    const packages = await packageService.getApprovedPackages(page)
    return res.status(200).json(packages)
  } catch (error) {
    logger.error(`Error fetching package list: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch packages' })
  }
}

const getFeaturedPackage = async (_req: Request, res: Response) => {
  try {
    const result = await packageService.getFeaturedPackage()
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error fetching featured package: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch featured package' })
  }
}

const viewPackage = async (req: Request, res: Response) => {
  const packageId = String(req.params.id || '')

  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const result = await packageService.viewPackage(packageId, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error fetching package ${packageId}: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch package' })
  }
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
    const result = await packageService.discoverPackages({
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
    })

    return res.status(200).json(result)
  } catch (error) {
    logger.error(`Error fetching packages: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch packages' })
  }
}

const postPackage = async (req: Request, res: Response) => {
  logger.info('postPackage endpoint called')

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const validation = validateSchema(createPackageSchema, req.body)

  if(!validation.success){
    return res.status(400).json({
      message: "Validation Failed",
      errors: validation.errors
    })
  }

  try{
    const createdPackage = await packageService.createPackageForApproval(validation.data, req.userId)

    return res.status(201).json({
      message: "Package submitted for approval successfully",
      data: createdPackage,
    })
  }catch(error){
    logger.error(`Error creating package: ${error}`)
    return res.status(500).json({ message: "Failed to create Package" })
  }
}

const createDraftPackage = async (req: Request, res: Response) => {
  logger.info('createDraftPackage endpoint called')

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const validation = validateSchema(draftPackageSchema, req.body)

  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  try {
    const result = await packageService.createDraftPackage(validation.data, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error saving draft package: ${error}`)
    return res.status(500).json({ message: 'Failed to save draft package' })
  }
}

const getDraftPackages = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const response = await packageService.getDraftPackages(req.userId)
    return res.status(200).json(response)
  } catch (error) {
    logger.error(`Error fetching draft packages: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch draft packages' })
  }
}

const getPackageDetails = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const packageId = String(req.params.id || '')

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  try {
    const result = await packageService.getPackageDetails(packageId, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error fetching package details: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch package details' })
  }
}

const getEditablePackage = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const packageId = String(req.params.id || '')

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  try {
    const result = await packageService.getEditablePackage(packageId, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error fetching editable package: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch editable package' })
  }
}

const updateDraftPackage = async (req: Request, res: Response) => {
  const packageId = String(req.params.id || '')
  logger.info(`updateDraftPackage endpoint called for id: ${packageId || 'not provided'}`)

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  const validation = validateSchema(draftPackageSchema, req.body)

  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  try {
    const result = await packageService.updateDraftPackage(packageId, validation.data, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error updating draft package: ${error}`)
    return res.status(500).json({ message: 'Failed to update draft package' })
  }
}

const submitPackageForApproval = async (req: Request, res: Response) => {
  const packageId = String(req.params.id || '')
  logger.info(`submitPackageForApproval endpoint called for id: ${packageId || 'not provided'}`)

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  try {
    const result = await packageService.submitPackageForApproval(packageId, req.body, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error submitting package for approval: ${error}`)
    return res.status(500).json({ message: 'Failed to submit package for approval' })
  }
}

const updatePackage = async (req: Request, res: Response) => {
  const packageId = String(req.params.id || '')
  logger.info(`updatePackage endpoint called for id: ${packageId || 'not provided'}`)

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

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
    const result = await packageService.updatePackage(packageId, validation.data, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error updating package: ${error}`)
    return res.status(500).json({ message: 'Failed to update package' })
  }
}

const postPackageReview = async (req: Request, res: Response) => {
  logger.info('postPackageReview endpoint called')

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const validation = validateSchema(createReviewSchema, req.body)
  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors
    })
  }

  try {
    const result = await packageService.createPackageReview(validation.data, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error creating package review: ${error}`)
    return res.status(500).json({ message: 'Failed to create package review' })
  }
}

const getReviewEligibility = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const packageId = String(req.params.id || '')

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  try {
    const result = await packageService.getReviewEligibility(packageId, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error fetching review eligibility for package ${packageId}: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch review eligibility' })
  }
}

const getPackageReviews = async (req: Request, res: Response) => {
  const packageId = String(req.params.id || '')

  if (!packageId) {
    return res.status(400).json({ message: 'Package id is required' })
  }

  try {
    const result = await packageService.getPackageReviews(packageId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error fetching reviews for package ${packageId}: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch reviews' })
  }
}

const deletePackage = async (req: Request, res: Response) => {
  logger.info(`deletePackage endpoint called for id: ${req.params.id || 'not provided'}`)

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  
  const packageId = String(req.params.id || '')

  try {
    const result = await packageService.deletePackage(packageId, req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error deleting package: ${error}`)
    return res.status(500).json({ message: 'Failed to delete package' })
  }
}

const getPendingPackages = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const result = await packageService.getPendingPackages(req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error fetching pending packages: ${error}`)
    return res.status(500).json({ message: 'Failed to fetch pending packages' })
  }
}

const approvePackage = async(req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const result = await packageService.approvePackage(String(req.params.id || ''), req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error approving package: ${error}`)
    return res.status(500).json({ message: 'Failed to approve package' })
  }
}

const unapprovePackage = async(req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const result = await packageService.unapprovePackage(String(req.params.id || ''), req.userId)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error unapproving package: ${error}`)
    return res.status(500).json({ message: 'Failed to unapprove package' })
  }
}

const rejectPackage = async(req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const rejectionReason =
      typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim()
        : undefined
    const result = await packageService.rejectPackage(String(req.params.id || ''), req.userId, rejectionReason)
    return res.status(result.status).json(result.body)
  } catch (error) {
    logger.error(`Error rejecting package: ${error}`)
    return res.status(500).json({ message: 'Failed to reject package' })
  }
}

const revealPackage = async(req: Request, res: Response) => {
  if(!req.userId) return res.status(401).json({ message: 'Unauthorized' })

  try{
    const packageId = String(req.params.id || '')

    if (!packageId) {
      return res.status(400).json({ message: 'Package id is required' })
    }

    const result = await packageService.revealPackage(packageId, req.userId)
    return res.status(result.status).json(result.body)
  }
  catch(err: any){
    logger.error(err.message)
    return res.status(500).json({ message: 'Failed to reveal package' })
  }
} 

const likePackage = async(req: Request, res: Response) => {
  if(!req.userId) return res.status(401).json({ message: 'Unauthorized' })

  try{
    const packageId = String(req.params.id || '')

    if (!packageId) {
      return res.status(400).json({ message: 'Package id is required' })
    }

    const result = await packageService.likePackage(packageId, req.userId)
    return res.status(result.status).json(result.body)
  }
  catch(err: any){
    logger.error(err.message)
    return res.status(500).json({ message: 'Failed to like package' })
  }
} 

const getLikedPackages = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const response = await packageService.getLikedPackages(req.userId)
    return res.status(200).json(response)
  } catch (error) {
    logger.error(`Error fetching liked packages: ${error}`)
    return res.status(500).json({ message: 'Failed to get liked packages' })
  }
}

export {
  getPackages,
  getFeaturedPackage,
  viewPackage,
  discoverPackage,
  getPendingPackages,
  postPackage,
  createDraftPackage,
  getDraftPackages,
  getPackageDetails,
  getEditablePackage,
  updateDraftPackage,
  submitPackageForApproval,
  updatePackage,
  postPackageReview,
  getReviewEligibility,
  getPackageReviews,
  deletePackage,
  approvePackage,
  unapprovePackage,
  rejectPackage,
  revealPackage,
  getLikedPackages,
  likePackage,
}
