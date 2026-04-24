import { Request, Response } from 'express';
import logger from '../config/logger'

const getPackages = (req: Request, res: Response) => {
  logger.info('getPackages endpoint called')
  res.status(200).json({ message: 'getPackages working' })
}

const viewPackage = (req: Request, res: Response) => {
  logger.info(`viewPackage endpoint called for id: ${req.params.id || 'not provided'}`)
  res.status(200).json({ message: 'viewPackage working' })
}

const postPackage = (req: Request, res: Response) => {
  logger.info('postPackage endpoint called')
  res.status(201).json({ message: 'postPackage working' })
}

const updatePackage = (req: Request, res: Response) => {
  logger.info(`updatePackage endpoint called for id: ${req.params.id || 'not provided'}`)
  res.status(200).json({ message: 'updatePackage working' })
}

const postPackageReview = (req: Request, res: Response) => {
  logger.info('postPackageReview endpoint called')
  res.status(201).json({ message: 'postPackageReview working' })
}

const deletePackage = (req: Request, res: Response) => {
  logger.info(`deletePackage endpoint called for id: ${req.params.id || 'not provided'}`)
  res.status(200).json({ message: 'deletePackage working' })
}

export { getPackages, viewPackage, postPackage, updatePackage, postPackageReview, deletePackage }
