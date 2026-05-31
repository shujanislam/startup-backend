import { vi } from 'vitest'

export const createMockResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  }

  res.status.mockReturnValue(res)

  return res
}
