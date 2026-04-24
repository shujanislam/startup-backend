import { Request, Response } from 'express';
import logger from '../config/logger'

const getProfiles = (req: Request, res: Response) => {
  logger.info('getProfiles endpoint called')
  res.status(200).json({ message: 'getProfiles working' })
}

const showProfile = (req: Request, res: Response) => {
  logger.info(`showProfile endpoint called for id: ${req.params.id}`)
  res.status(200).json({ message: 'showProfile working' })
}

const updateProfile = (req: Request, res: Response) => {
  logger.info(`updateProfile endpoint called for id: ${req.params.id}`)
  res.status(200).json({ message: 'updateProfile working' })
}

const deleteProfile = (req: Request, res: Response) => {
  logger.info(`deleteProfile endpoint called for id: ${req.params.id}`)
  res.status(200).json({ message: 'deleteProfile working' })
}

export { getProfiles, showProfile, updateProfile, deleteProfile }
