import type { Request } from 'express'
import type { DecodedIdToken } from 'firebase-admin/auth'

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string
    token: DecodedIdToken
  }
}

export type { AuthenticatedRequest }