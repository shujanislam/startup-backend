import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import Package from '../src/models/Package'
import PackageReview from '../src/models/PackageReviews'

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

const askRating = async (rl: ReturnType<typeof createInterface>): Promise<number> => {
  while (true) {
    const value = (await rl.question('Rating (1-5): ')).trim()
    const parsed = Number(value)

    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) {
      return parsed
    }

    console.log('Rating must be an integer between 1 and 5.')
  }
}

const run = async (): Promise<void> => {
  const rl = createInterface({ input, output })

  try {
    await connectDB()

    console.log('Enter package review details:')

    const packageId = await askRequired(rl, 'Package ID')
    const review = await askRequired(rl, 'Review text')
    const rating = await askRating(rl)

    const packageExists = await Package.exists({ _id: packageId })

    if (!packageExists) {
      console.log('Package not found. Review was not inserted.')
      process.exitCode = 1
      return
    }

    const createdReview = await PackageReview.create({
      packageId,
      userId: DUMMY_USER_ID,
      review,
      rating,
    })

    console.log('Package review inserted successfully.')
    console.log(`Review ID: ${createdReview._id.toString()}`)
  } catch (error) {
    console.error(
      `Failed to insert package review: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
    process.exitCode = 1
  } finally {
    rl.close()
    await mongoose.disconnect()
  }
}

void run()
