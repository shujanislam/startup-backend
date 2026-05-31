import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/models/Hotel', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}))

vi.mock('../../../src/config/redis', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
  },
}))

vi.mock('../../../src/config/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../../src/utils/roleCheck', () => ({
  checkAdminRole: vi.fn(),
}))

vi.mock('../../../src/utils/validSchema', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils/validSchema')>('../../../src/utils/validSchema')

  return {
    ...actual,
    validateSchema: vi.fn(),
  }
})

import redis from '../../../src/config/redis'
import { getHotels, postHotel, updateHotel, viewHotel } from '../../../src/controllers/hotel.controllers'
import Hotel from '../../../src/models/Hotel'
import { checkAdminRole } from '../../../src/utils/roleCheck'
import { validateSchema } from '../../../src/utils/validSchema'
import { createMockResponse } from '../helpers/mockResponse'

describe('hotel controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getHotels', () => {
    it('returns 401 when user is not authenticated', async () => {
      const res = createMockResponse()

      await getHotels({} as never, res as never)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' })
    })

    it('returns cached hotels for admin users', async () => {
      const hotels = [{ _id: 'hotel-1', name: 'Yak Hotel' }]
      const res = createMockResponse()

      vi.mocked(checkAdminRole).mockResolvedValue({ ok: true, status: 200, message: 'Admin' })
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(hotels))

      await getHotels({ userId: 'admin-1' } as never, res as never)

      expect(Hotel.find).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(hotels)
    })
  })

  describe('viewHotel', () => {
    it('returns 404 when hotel does not exist', async () => {
      const res = createMockResponse()

      vi.mocked(redis.get).mockResolvedValue(null)
      vi.mocked(Hotel.findById).mockResolvedValue(null)

      await viewHotel({ params: { id: 'hotel-1' } } as never, res as never)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: 'Hotel not found' })
    })
  })

  describe('postHotel', () => {
    it('creates hotel with current user id', async () => {
      const res = createMockResponse()
      const data = { name: 'Yak Hotel' }
      const createdHotel = { _id: 'hotel-1', ...data, createdBy: 'user-1' }

      vi.mocked(validateSchema).mockReturnValue({ success: true, data })
      vi.mocked(Hotel.create).mockResolvedValue(createdHotel)

      await postHotel({ userId: 'user-1', body: data } as never, res as never)

      expect(Hotel.create).toHaveBeenCalledWith({ ...data, createdBy: 'user-1' })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ message: 'Hotel created successfully', data: createdHotel })
    })
  })

  describe('updateHotel', () => {
    it('returns 400 when no valid fields are provided', async () => {
      const res = createMockResponse()

      vi.mocked(validateSchema).mockReturnValue({ success: true, data: {} })

      await updateHotel({ params: { id: 'hotel-1' }, body: {} } as never, res as never)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'No valid fields provided for update' })
    })
  })
})
