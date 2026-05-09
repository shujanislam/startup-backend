import type { DraftPackageInput } from './validSchema'

const hasMeaningfulValue = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.some(hasMeaningfulValue)
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some(hasMeaningfulValue)
  }

  return false
}

const normalizeStringList = (items?: string[]) =>
  (items ?? []).map((item) => item.trim()).filter(Boolean)

const normalizeDraftHotels = (hotels?: DraftPackageInput['draftHotels']) =>
  (hotels ?? [])
    .filter(hasMeaningfulValue)
    .map((hotel) => ({
      name: hotel.name?.trim() ?? '',
      phoneNumber: hotel.phoneNumber?.trim() ?? '',
      address: hotel.address?.trim() ?? '',
      photos: normalizeStringList(hotel.photos),
      ...(hotel.budget !== undefined ? { budget: hotel.budget } : {}),
    }))

const normalizeDraftVehicles = (vehicles?: DraftPackageInput['draftVehicles']) =>
  (vehicles ?? [])
    .filter(hasMeaningfulValue)
    .map((vehicle) => ({
      car: vehicle.car?.trim() ?? '',
      carNumber: vehicle.carNumber?.trim() ?? '',
      driverName: vehicle.driverName?.trim() ?? '',
      driverPhoneNumber: vehicle.driverPhoneNumber?.trim() ?? '',
      vehicleType: vehicle.vehicleType?.trim() ?? '',
      ...(vehicle.budget !== undefined ? { budget: vehicle.budget } : {}),
    }))

const normalizeDraftPayload = (data: DraftPackageInput) => ({
  ...data,
  ...(data.spots ? { spots: normalizeStringList(data.spots) } : {}),
  ...(data.tags ? { tags: normalizeStringList(data.tags) } : {}),
  ...(data.affiliateLinks ? { affiliateLinks: normalizeStringList(data.affiliateLinks) } : {}),
  ...(data.draftHotels ? { draftHotels: normalizeDraftHotels(data.draftHotels) } : {}),
  ...(data.draftVehicles ? { draftVehicles: normalizeDraftVehicles(data.draftVehicles) } : {}),
})

const normalizeObjectIdList = (items: unknown[] | undefined) =>
  (items ?? [])
    .map((item) => String(item))
    .filter(Boolean)

export {
  normalizeStringList,
  normalizeDraftHotels,
  normalizeDraftVehicles,
  normalizeDraftPayload,
  normalizeObjectIdList,
}
