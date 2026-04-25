import type { DecodedIdToken } from 'firebase-admin/auth'

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string
        token: DecodedIdToken
      }
    }
  }
}

export {}