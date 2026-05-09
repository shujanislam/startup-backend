import type { CreatePackageInput } from './validSchema'

import Hotel from '../models/Hotel'
import Vehicle from '../models/Vehicle'

const createRelatedPackageRecords = async (
  data: CreatePackageInput,
  userId: string,
): Promise<{ hotels: string[]; vehicles: string[] }> => {
  const hotelIds = [...data.hotels]
  const vehicleIds = [...data.vehicles]

  if (data.draftHotels.length > 0) {
    const createdHotels = await Hotel.insertMany(
      data.draftHotels.map((hotel) => ({
        ...hotel,
        createdBy: userId,
      })),
    )

    hotelIds.push(...createdHotels.map((hotel) => hotel._id.toString()))
  }

  if (data.draftVehicles.length > 0) {
    const createdVehicles = await Vehicle.insertMany(
      data.draftVehicles.map((vehicle) => ({
        ...vehicle,
        createdBy: userId,
      })),
    )

    vehicleIds.push(...createdVehicles.map((vehicle) => vehicle._id.toString()))
  }

  return { hotels: hotelIds, vehicles: vehicleIds }
}

export { createRelatedPackageRecords }
