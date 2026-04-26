import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import Package from '../src/models/Package'

const DUMMY_USER_ID = '000000000000000000000001'

const askRequired = async (
  rl: ReturnType<typeof createInterface>,
  label: string,
): Promise<string> => {
  while (true) {
    const value = (await rl.question(`${label}: `)).trim()
    if (value.length > 0) {
      return value
    }
    console.log(`${label} is required.`)
  }
}

const askNumber = async (
  rl: ReturnType<typeof createInterface>,
  label: string,
): Promise<number> => {
  while (true) {
    const value = (await rl.question(`${label}: `)).trim()
    const parsed = Number(value)

    if (!Number.isNaN(parsed)) {
      return parsed
    }

    console.log(`${label} must be a valid number.`)
  }
}

const askBoolean = async (
  rl: ReturnType<typeof createInterface>,
  label: string,
): Promise<boolean> => {
  while (true) {
    const value = (await rl.question(`${label} (y/n): `)).trim().toLowerCase()

    if (value === 'y' || value === 'yes') {
      return true
    }

    if (value === 'n' || value === 'no') {
      return false
    }

    console.log('Please answer with y or n.')
  }
}

const askList = async (
  rl: ReturnType<typeof createInterface>,
  label: string,
): Promise<string[]> => {
  const value = (await rl.question(`${label} (comma-separated, optional): `)).trim()

  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const run = async (): Promise<void> => {
  const rl = createInterface({ input, output })

  try {
    await connectDB()

    console.log('Enter package details:')

    const name = await askRequired(rl, 'Name')
    const description = await askRequired(rl, 'Description')
    const coverImage = await askRequired(rl, 'Cover image URL')
    const season = await askRequired(rl, 'Season')
    const budget = await askNumber(rl, 'Budget')
    const destination = await askRequired(rl, 'Destination')
    const spots = await askList(rl, 'Spots')
    const duration = await askNumber(rl, 'Duration (days)')
    const startDate = await askRequired(rl, 'Start date')
    const endDate = await askRequired(rl, 'End date')
    const identification = await askBoolean(rl, 'Identification required')
    const permit = await askRequired(rl, 'Permit details')
    const tags = await askList(rl, 'Tags')
    const affiliateLinks = await askList(rl, 'Affiliate links')
    const additional = (await rl.question('Additional info (optional): ')).trim() || undefined

    const createdPackage = await Package.create({
      name,
      description,
      coverImage,
      season,
      budget,
      destination,
      spots,
      duration,
      startDate,
      endDate,
      identification,
      permit,
      tags,
      affiliateLinks,
      additional,
      createdBy: DUMMY_USER_ID,
      hotels: [],
      vehicles: [],
    })

    console.log('Package inserted successfully.')
    console.log(`Package ID: ${createdPackage._id.toString()}`)
  } catch (error) {
    console.error(
      `Failed to insert package: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
    process.exitCode = 1
  } finally {
    rl.close()
    await mongoose.disconnect()
  }
}

void run()
