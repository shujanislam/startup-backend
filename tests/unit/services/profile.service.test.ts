import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/config/redis', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}))

vi.mock('../../../src/config/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../../src/models/User', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    exists: vi.fn(),
  },
}))

vi.mock('../../../src/models/Package', () => ({
  default: {
    find: vi.fn(),
  },
}))

vi.mock('../../../src/models/UserPackageReveal', () => ({
  default: {
    find: vi.fn(),
  },
}))

vi.mock('../../../src/utils/roleCheck', () => ({
  checkAdminRole: vi.fn(),
}))

vi.mock('../../../src/utils/uploadProfileImage', () => ({
  deleteOldProfileImage: vi.fn(),
}))

import redis from '../../../src/config/redis'
import Package from '../../../src/models/Package'
import User from '../../../src/models/User'
import UserPackageReveal from '../../../src/models/UserPackageReveal'
import * as profileService from '../../../src/services/profile.service'
import { checkAdminRole } from '../../../src/utils/roleCheck'
import { deleteOldProfileImage } from '../../../src/utils/uploadProfileImage'

describe('profile service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProfiles', () => {
    it('returns role check failure for non-admin users', async () => {
      vi.mocked(checkAdminRole).mockResolvedValue({ ok: false, status: 403, message: 'Forbidden' })

      const result = await profileService.getProfiles('user-1')

      expect(result).toEqual({ status: 403, body: { message: 'Forbidden' } })
      expect(User.find).not.toHaveBeenCalled()
    })

    it('returns cached profiles for admin users', async () => {
      const profiles = [{ _id: 'user-1', name: 'Ayan' }]

      vi.mocked(checkAdminRole).mockResolvedValue({ ok: true, status: 200, message: 'Admin' })
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(profiles))

      const result = await profileService.getProfiles('admin-1')

      expect(redis.get).toHaveBeenCalledWith('profiles:list')
      expect(User.find).not.toHaveBeenCalled()
      expect(result).toEqual({ status: 200, body: profiles })
    })
  })

  describe('showProfile', () => {
    it('computes ownProfile per request from cached profile', async () => {
      const profile = { _id: 'user-1', name: 'Ayan' }

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(profile))

      const result = await profileService.showProfile('user-1', 'user-1')

      expect(result).toEqual({ status: 200, body: { profile, ownProfile: true } })
    })
  })

  describe('updateProfile', () => {
    it('deletes the old profile image and invalidates cache when updating image', async () => {
      const updatedProfile = { _id: 'user-1', name: 'Ayan' }
      const select = vi.fn().mockResolvedValue(updatedProfile)

      vi.mocked(User.findById).mockResolvedValue({ profileImagePath: 'old.jpg' })
      vi.mocked(User.findByIdAndUpdate).mockReturnValue({ select } as never)

      const result = await profileService.updateProfile('user-1', { name: 'Ayan' }, 'new.jpg')

      expect(deleteOldProfileImage).toHaveBeenCalledWith('old.jpg')
      expect(redis.del).toHaveBeenCalledWith('profile:user-1')
      expect(redis.del).toHaveBeenCalledWith('profiles:list')
      expect(result).toEqual({
        status: 200,
        body: { message: 'Profile updated successfully', data: updatedProfile },
      })
    })
  })

  describe('getRevealedPackages', () => {
    it('returns revealed packages for existing users', async () => {
      const packages = [{ _id: 'pkg-1', name: 'Everest' }]
      const sort = vi.fn().mockResolvedValue(packages)
      const select = vi.fn(() => ({ sort }))

      vi.mocked(User.exists).mockResolvedValue({ _id: 'user-1' })
      vi.mocked(UserPackageReveal.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ packageId: 'pkg-1' }]),
      } as never)
      vi.mocked(Package.find).mockReturnValue({ select } as never)

      const result = await profileService.getRevealedPackages('user-1')

      expect(Package.find).toHaveBeenCalledWith({ _id: { $in: ['pkg-1'] } })
      expect(result).toEqual({
        status: 200,
        body: { message: 'User revealed packages fetched successfully', data: packages },
      })
    })
  })
})
