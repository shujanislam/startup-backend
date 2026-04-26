import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import Package from '../src/models/Package'
import Hotel from '../src/models/Hotel'
import Vehicle from '../src/models/Vehicle'

const DUMMY_USER_ID = '000000000000000000000001'

interface SeedHotel {
  name: string
  phoneNumber: string
  address: string
  photos: string[]
  budget: number
}

interface SeedVehicle {
  car: string
  carNumber: string
  driverName: string
  driverPhoneNumber: string
  vehicleType: string
  budget: number
}

interface SeedItem {
  name: string
  description: string
  destination: string
  season: 'summer' | 'winter' | 'monsoon' | 'autumn'
  budget: number
  duration: number
  spots: string[]
  permit: string
  tags: string[]
  coverImage: string
  hotels: SeedHotel[]
  vehicles: SeedVehicle[]
}

type SeedBaseItem = Omit<SeedItem, 'hotels' | 'vehicles'>

const vehicleTypes = ['SUV', 'Sedan', 'Tempo Traveller', 'Mini Bus']
const vehicleModels = ['Toyota Innova', 'Mahindra XUV700', 'Kia Carens', 'Maruti Ertiga']

const buildHotels = (item: SeedBaseItem, index: number): SeedHotel[] => {
  return [
    {
      name: `${item.destination} Grand Residency`,
      phoneNumber: `+91-90010${String(1000 + index)}`,
      address: `${item.destination} central boulevard, near market square`,
      photos: [
        `https://picsum.photos/seed/${item.destination.toLowerCase()}-hotel-a/900/600`,
        item.coverImage,
      ],
      budget: Math.max(2500, Math.floor(item.budget * 0.25)),
    },
    {
      name: `${item.destination} Viewpoint Suites`,
      phoneNumber: `+91-90020${String(1000 + index)}`,
      address: `${item.destination} scenic bypass road, viewpoint district`,
      photos: [
        `https://picsum.photos/seed/${item.destination.toLowerCase()}-hotel-b/900/600`,
      ],
      budget: Math.max(2200, Math.floor(item.budget * 0.22)),
    },
  ]
}

const buildVehicles = (item: SeedBaseItem, index: number): SeedVehicle[] => {
  const modelA = vehicleModels[index % vehicleModels.length]
  const modelB = vehicleModels[(index + 1) % vehicleModels.length]
  const typeA = vehicleTypes[index % vehicleTypes.length]
  const typeB = vehicleTypes[(index + 1) % vehicleTypes.length]

  return [
    {
      car: modelA,
      carNumber: `DL0${(index % 9) + 1}AB${2000 + index}`,
      driverName: `Driver ${index + 1}A`,
      driverPhoneNumber: `+91-98880${String(1000 + index)}`,
      vehicleType: typeA,
      budget: Math.max(1800, Math.floor(item.budget * 0.12)),
    },
    {
      car: modelB,
      carNumber: `DL0${(index % 9) + 1}CD${3000 + index}`,
      driverName: `Driver ${index + 1}B`,
      driverPhoneNumber: `+91-97770${String(1000 + index)}`,
      vehicleType: typeB,
      budget: Math.max(1700, Math.floor(item.budget * 0.1)),
    },
  ]
}

const seedBaseItems: SeedBaseItem[] = [
  {
    name: 'Himalayan Sunrise Circuit',
    description: 'Mountain sunrise viewpoints, village walks, and scenic ridge trails.',
    destination: 'Sikkim',
    season: 'winter',
    budget: 18999,
    duration: 5,
    spots: ['Gangtok', 'Tsomgo Lake', 'Nathula Pass'],
    permit: 'Inner line permit for restricted zones.',
    tags: ['mountains', 'views', 'snow'],
    coverImage: 'https://picsum.photos/seed/sikkim-trip/1400/900',
  },
  {
    name: 'Desert Nights Escape',
    description: 'Camel safari evenings, local music, and starry desert camps.',
    destination: 'Jaisalmer',
    season: 'autumn',
    budget: 14999,
    duration: 4,
    spots: ['Sam Sand Dunes', 'Jaisalmer Fort', 'Kuldhara'],
    permit: 'Government ID required at check-in.',
    tags: ['desert', 'camping', 'culture'],
    coverImage: 'https://picsum.photos/seed/jaisalmer-trip/1400/900',
  },
  {
    name: 'Coastal Breeze Weekend',
    description: 'Beach hopping, cafe trails, and sunset kayaking sessions.',
    destination: 'Goa',
    season: 'summer',
    budget: 12999,
    duration: 3,
    spots: ['Anjuna', 'Vagator', 'Candolim'],
    permit: 'No special permit required.',
    tags: ['beach', 'nightlife', 'food'],
    coverImage: 'https://picsum.photos/seed/goa-trip/1400/900',
  },
  {
    name: 'Rainforest Trail Retreat',
    description: 'Waterfalls, canopy walks, and guided forest exploration.',
    destination: 'Meghalaya',
    season: 'monsoon',
    budget: 20999,
    duration: 6,
    spots: ['Cherrapunji', 'Mawlynnong', 'Dawki'],
    permit: 'Local eco-fee may apply.',
    tags: ['nature', 'waterfalls', 'hiking'],
    coverImage: 'https://picsum.photos/seed/meghalaya-trip/1400/900',
  },
  {
    name: 'Tea Valley Slow Travel',
    description: 'Toy train views, tea estate visits, and cozy hill stays.',
    destination: 'Darjeeling',
    season: 'winter',
    budget: 17499,
    duration: 5,
    spots: ['Tiger Hill', 'Batasia Loop', 'Happy Valley Tea Estate'],
    permit: 'Government ID required.',
    tags: ['hills', 'tea', 'relax'],
    coverImage: 'https://picsum.photos/seed/darjeeling-trip/1400/900',
  },
  {
    name: 'Backwater Serenity Route',
    description: 'Houseboat stay, village canals, and lakeside sunsets.',
    destination: 'Alleppey',
    season: 'autumn',
    budget: 16999,
    duration: 4,
    spots: ['Vembanad Lake', 'Kuttanad', 'Marari Beach'],
    permit: 'No special permit required.',
    tags: ['backwaters', 'boat', 'relax'],
    coverImage: 'https://picsum.photos/seed/alleppey-trip/1400/900',
  },
  {
    name: 'Forts and Flavors Walk',
    description: 'Historic forts, local market food trails, and night bazaars.',
    destination: 'Jaipur',
    season: 'autumn',
    budget: 13999,
    duration: 3,
    spots: ['Amber Fort', 'Hawa Mahal', 'Johari Bazaar'],
    permit: 'Government ID required.',
    tags: ['history', 'city', 'food'],
    coverImage: 'https://picsum.photos/seed/jaipur-trip/1400/900',
  },
  {
    name: 'Island Reef Discovery',
    description: 'Coral-view boating, snorkeling, and beachside evenings.',
    destination: 'Andaman',
    season: 'summer',
    budget: 28999,
    duration: 6,
    spots: ['Havelock Island', 'Radhanagar Beach', 'Neil Island'],
    permit: 'Island entry permit handled by operator.',
    tags: ['islands', 'snorkeling', 'ocean'],
    coverImage: 'https://picsum.photos/seed/andaman-trip/1400/900',
  },
  {
    name: 'Temple Coast Explorer',
    description: 'Shore temples, artisan streets, and heritage townscapes.',
    destination: 'Mahabalipuram',
    season: 'winter',
    budget: 11999,
    duration: 3,
    spots: ['Shore Temple', 'Five Rathas', 'Crocodile Bank'],
    permit: 'No special permit required.',
    tags: ['heritage', 'architecture', 'coast'],
    coverImage: 'https://picsum.photos/seed/mahabalipuram-trip/1400/900',
  },
  {
    name: 'Snowline Adventure Loop',
    description: 'Frozen valley drives, warm cafes, and alpine viewpoints.',
    destination: 'Manali',
    season: 'winter',
    budget: 21999,
    duration: 5,
    spots: ['Solang Valley', 'Atal Tunnel', 'Old Manali'],
    permit: 'Rohtang permit may be required.',
    tags: ['snow', 'adventure', 'roadtrip'],
    coverImage: 'https://picsum.photos/seed/manali-trip/1400/900',
  },
  {
    name: 'Monsoon Coastline Drive',
    description: 'Cliffside drives, ocean spray viewpoints, and homestay nights.',
    destination: 'Konkan',
    season: 'monsoon',
    budget: 15999,
    duration: 4,
    spots: ['Ganpatipule', 'Ratnagiri', 'Tarkarli'],
    permit: 'No special permit required.',
    tags: ['roadtrip', 'coast', 'rain'],
    coverImage: 'https://picsum.photos/seed/konkan-trip/1400/900',
  },
  {
    name: 'Lake City Culture Weekender',
    description: 'Palace views, old town lanes, and evening boat rides.',
    destination: 'Udaipur',
    season: 'autumn',
    budget: 15499,
    duration: 3,
    spots: ['City Palace', 'Lake Pichola', 'Fateh Sagar'],
    permit: 'Government ID required.',
    tags: ['city', 'culture', 'lakes'],
    coverImage: 'https://picsum.photos/seed/udaipur-trip/1400/900',
  },
]

const seedItems: SeedItem[] = seedBaseItems.map((item, index) => ({
  ...item,
  hotels: buildHotels(item, index),
  vehicles: buildVehicles(item, index),
}))

const getDateWindow = (duration: number, offsetDays: number): { startDate: string; endDate: string } => {
  const start = new Date()
  start.setDate(start.getDate() + offsetDays)

  const end = new Date(start)
  end.setDate(start.getDate() + duration)

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

const run = async (): Promise<void> => {
  const shouldClear = process.argv.includes('--clear')

  try {
    await connectDB()

    if (shouldClear) {
      await Promise.all([
        Package.deleteMany({ createdBy: DUMMY_USER_ID }),
        Hotel.deleteMany({}),
        Vehicle.deleteMany({}),
      ])
      console.log('Cleared old seed data.')
    }

    let inserted = 0

    for (let i = 0; i < seedItems.length; i += 1) {
      const item = seedItems[i]
      const { startDate, endDate } = getDateWindow(item.duration, i * 4)

      const hotels = await Hotel.insertMany(item.hotels)
      const vehicles = await Vehicle.insertMany(item.vehicles)

      await Package.create({
        name: item.name,
        description: item.description,
        coverImage: item.coverImage,
        season: item.season,
        budget: item.budget,
        destination: item.destination,
        spots: item.spots,
        duration: item.duration,
        startDate,
        endDate,
        identification: true,
        permit: item.permit,
        tags: item.tags,
        affiliateLinks: [],
        additional: 'Seeded sample itinerary package.',
        createdBy: DUMMY_USER_ID,
        hotels: hotels.map((hotel) => hotel._id),
        vehicles: vehicles.map((vehicle) => vehicle._id),
      })

      inserted += 1
    }

    console.log(`Seed complete. Inserted ${inserted} packages.`)
  } catch (error) {
    console.error(`Seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

void run()
