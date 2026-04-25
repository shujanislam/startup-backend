import { Request, Response, NextFunction } from 'express'

import User from '../models/User'

export const attachCurrentUser = async(req: Request, res: Response, next: NextFunction) => {
  if(!req.user?.uid) return res.status(401).json({ message: 'Unauthorized' })

  const user = await User.findOne({ firebaseId: req.user.uid }).select('_id firebaseId email')

  if(!user) return res.status(401).json({ message: 'User not found' })

  req.userId = user._id.toString()

  req.userDoc = user

  next()
}
