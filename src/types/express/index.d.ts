import type { DecodedIdToken } from 'firebase-admin/auth'
import type { HydratedDocument } from 'mongoose'
import type { IUser } from '../../models/User'

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string
        token: DecodedIdToken
      }
      userId?: string
      userDoc?: HydratedDocument<IUser>
    }
  }
}

export {}
