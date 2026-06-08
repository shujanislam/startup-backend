import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DecodedIdToken } from 'firebase-admin/auth'

vi.mock('../../../src/models/User', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}))

import User from '../../../src/models/User'
import { ensureUserForFirebaseToken } from '../../../src/services/auth.service'

const token = (overrides: Partial<DecodedIdToken> = {}): DecodedIdToken =>
  ({
    aud: 'project',
    auth_time: 0,
    exp: 0,
    firebase: { identities: {}, sign_in_provider: 'password' },
    iat: 0,
    iss: 'issuer',
    sub: 'firebase-uid',
    uid: 'firebase-uid',
    email: 'ayan@example.com',
    name: 'Ayan',
    ...overrides,
  }) as DecodedIdToken

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ensureUserForFirebaseToken', () => {
    it('links an existing email-matched user to the current Firebase uid', async () => {
      const existingUser = {
        _id: 'user-1',
        firebaseId: 'old-firebase-uid',
        email: 'ayan@example.com',
        save: vi.fn().mockResolvedValue(undefined),
      }

      vi.mocked(User.findOne).mockResolvedValue(existingUser)

      const result = await ensureUserForFirebaseToken('firebase-uid', token())

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ firebaseId: 'firebase-uid' }, { email: 'ayan@example.com' }],
      })
      expect(existingUser.firebaseId).toBe('firebase-uid')
      expect(existingUser.save).toHaveBeenCalled()
      expect(User.create).not.toHaveBeenCalled()
      expect(result).toBe(existingUser)
    })

    it('creates a local user when Firebase auth succeeds and no MongoDB user exists', async () => {
      const createdUser = { _id: 'user-1', firebaseId: 'firebase-uid', email: 'ayan@example.com' }

      vi.mocked(User.findOne).mockResolvedValue(null)
      vi.mocked(User.create).mockResolvedValue(createdUser)

      const result = await ensureUserForFirebaseToken('firebase-uid', token())

      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firebaseId: 'firebase-uid',
          name: 'Ayan',
          email: 'ayan@example.com',
          gender: 'prefer_not_to_say',
        }),
      )
      expect(result).toBe(createdUser)
    })
  })
})
