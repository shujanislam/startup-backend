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

vi.mock('../../../src/models/Package', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../../../src/models/PackageReviews', () => ({
  default: {
    create: vi.fn(),
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('../../../src/models/User', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
  },
}))

vi.mock('../../../src/models/UserPackageReveal', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
    exists: vi.fn(),
  },
}))

vi.mock('../../../src/models/LikedPackage', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('../../../src/models/Hotel', () => ({
  default: {
    insertMany: vi.fn(),
  },
}))

vi.mock('../../../src/models/Vehicle', () => ({
  default: {
    insertMany: vi.fn(),
  },
}))

vi.mock('../../../src/utils/roleCheck', () => ({
  checkAdminRole: vi.fn(),
}))

vi.mock('../../../src/utils/uploadPackageCoverImage', () => ({
  deleteOldPackageCoverImage: vi.fn(),
  isLocalPackageCoverImagePath: vi.fn(),
}))

vi.mock('../../../src/utils/featuredPackage', () => ({
  computeFeaturedPackageScore: vi.fn(),
  getCurrentMonthKey: vi.fn(() => '2026-06'),
}))

import redis from '../../../src/config/redis'
import Package from '../../../src/models/Package'
import LikedPackage from '../../../src/models/LikedPackage'
import UserPackageReveal from '../../../src/models/UserPackageReveal'
import * as packageService from '../../../src/services/package.service'
import { checkAdminRole } from '../../../src/utils/roleCheck'

describe('package service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getApprovedPackages', () => {
    it('returns cached packages when Redis has data', async () => {
      const packages = [{ _id: 'pkg-1', name: 'Everest' }]

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(packages))

      const result = await packageService.getApprovedPackages(0)

      expect(redis.get).toHaveBeenCalledWith('packages:list:approved:true:0')
      expect(Package.find).not.toHaveBeenCalled()
      expect(result).toEqual(packages)
    })
  })

  describe('revealPackage', () => {
    it('rejects non-approved packages', async () => {
      vi.mocked(Package.findById).mockResolvedValue({ approved: false, status: 'pending_approval' })

      const result = await packageService.revealPackage('pkg-1', 'user-1')

      expect(result).toEqual({ status: 403, body: { message: 'Only approved packages can be revealed' } })
      expect(UserPackageReveal.create).not.toHaveBeenCalled()
    })
  })

  describe('likePackage', () => {
    it('returns alreadyLiked when user already liked the package', async () => {
      const existingPackage = { _id: 'pkg-1', approved: true, status: 'approved' }

      vi.mocked(Package.findById).mockResolvedValue(existingPackage)
      vi.mocked(LikedPackage.findOne).mockResolvedValue({ _id: 'like-1' })

      const result = await packageService.likePackage('pkg-1', 'user-1')

      expect(LikedPackage.create).not.toHaveBeenCalled()
      expect(result).toEqual({
        status: 200,
        body: {
          message: 'Package already liked',
          data: existingPackage,
          alreadyLiked: true,
        },
      })
    })
  })

  describe('approvePackage', () => {
    it('returns role check failure for non-admin users', async () => {
      vi.mocked(checkAdminRole).mockResolvedValue({ ok: false, status: 403, message: 'Forbidden' })

      const result = await packageService.approvePackage('pkg-1', 'user-1')

      expect(result).toEqual({ status: 403, body: { message: 'Forbidden' } })
      expect(Package.findById).not.toHaveBeenCalled()
    })
  })
})
