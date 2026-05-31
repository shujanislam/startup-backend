import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/models/Vehicle', () => ({
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

vi.mock('../../../src/utils/validSchema', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils/validSchema')>('../../../src/utils/validSchema')

  return {
    ...actual,
    validateSchema: vi.fn(),
  }
})

import redis from '../../../src/config/redis'
import { getVehicles, postVehicle, updateVehicle, viewVehicle } from '../../../src/controllers/vehicle.controllers'
import Vehicle from '../../../src/models/Vehicle'
import { validateSchema } from '../../../src/utils/validSchema'
import { createMockResponse } from '../helpers/mockResponse'

describe('vehicle controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getVehicles', () => {
    it('returns cached vehicles', async () => {
      const vehicles = [{ _id: 'vehicle-1', car: 'Jeep' }]
      const res = createMockResponse()

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(vehicles))

      await getVehicles({} as never, res as never)

      expect(Vehicle.find).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(vehicles)
    })
  })

  describe('viewVehicle', () => {
    it('returns 404 when vehicle does not exist', async () => {
      const res = createMockResponse()

      vi.mocked(redis.get).mockResolvedValue(null)
      vi.mocked(Vehicle.findById).mockResolvedValue(null)

      await viewVehicle({ params: { id: 'vehicle-1' } } as never, res as never)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: 'Vehicle not found' })
    })
  })

  describe('postVehicle', () => {
    it('returns 401 when user is not authenticated', async () => {
      const res = createMockResponse()

      await postVehicle({ body: {} } as never, res as never)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' })
    })

    it('creates vehicle with current user id', async () => {
      const res = createMockResponse()
      const data = { car: 'Jeep' }
      const createdVehicle = { _id: 'vehicle-1', ...data, createdBy: 'user-1' }

      vi.mocked(validateSchema).mockReturnValue({ success: true, data })
      vi.mocked(Vehicle.create).mockResolvedValue(createdVehicle)

      await postVehicle({ userId: 'user-1', body: data } as never, res as never)

      expect(Vehicle.create).toHaveBeenCalledWith({ ...data, createdBy: 'user-1' })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ message: 'Vehicle created successfully', data: createdVehicle })
    })
  })

  describe('updateVehicle', () => {
    it('returns 400 when no valid fields are provided', async () => {
      const res = createMockResponse()

      vi.mocked(validateSchema).mockReturnValue({ success: true, data: {} })

      await updateVehicle({ params: { id: 'vehicle-1' }, body: {} } as never, res as never)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: 'No valid fields provided for update' })
    })
  })
})
