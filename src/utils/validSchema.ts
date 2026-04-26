import { z, ZodSchema } from 'zod'

// Reusable validation function 
export const validateSchema = <T>(
    schema: ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } => {
    const result = schema.safeParse(data)
    if (!result.success) {
        return { success: false, errors: result.error }
    }
    return { success: true, data: result.data }
}

// User schemas
export const createUserSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    gender: z.string().min(1, "Gender is required"),
})

export const updateUserSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    gender: z.string().optional(),
    profilePicture: z.string().optional(),
    bio: z.string().optional(),
})

// Package schemas
export const createPackageSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    coverImage: z.string().min(1, "Cover image is required"),
    season: z.string().min(1, "Season is required"),
    budget: z.number().min(0, "Budget must be positive"),
    destination: z.string().min(1, "Destination is required"),
    spots: z.array(z.string()).default([]),
    duration: z.number().min(1, "Duration must be at least 1 day"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    identification: z.boolean().default(false),
    permit: z.string().min(1, "Permit info is required"),
    tags: z.array(z.string()).default([]),
    affiliateLinks: z.array(z.string()).default([]),
    additional: z.string().optional(),
    hotels: z.array(z.string()).default([]),
    vehicles: z.array(z.string()).default([]),
})

export const updatePackageSchema = createPackageSchema.partial()

export const createHotelSchema = z.object({
    name: z.string().min(1, 'Hotel name is required'),
    phoneNumber: z.string().min(1, 'Hotel phone number is required'),
    address: z.string().min(1, 'Hotel address is required'),
    photos: z.array(z.string()).default([]),
    budget: z.number().min(0, 'Hotel budget must be positive'),
})

export const updateHotelSchema = createHotelSchema.partial()

export const createVehicleSchema = z.object({
    car: z.string().min(1, 'Vehicle name is required'),
    carNumber: z.string().min(1, 'Vehicle number is required'),
    driverName: z.string().optional(),
    driverPhoneNumber: z.string().min(1, 'Driver phone number is required'),
    vehicleType: z.string().optional(),
    budget: z.number().min(0, 'Vehicle budget must be positive'),
})

export const updateVehicleSchema = createVehicleSchema.partial()

export const sortPackageSchema = z
    .object({
        search: z.string().trim().min(1).optional(),
        destination: z.string().trim().min(1).optional(),
        season: z.string().trim().min(1).optional(),
        minBudget: z.coerce.number().nonnegative().optional(),
        maxBudget: z.coerce.number().nonnegative().optional(),
        minDuration: z.coerce.number().int().positive().optional(),
        maxDuration: z.coerce.number().int().positive().optional(),
        tags: z
            .string()
            .trim()
            .optional()
            .transform((value) => {
                if (!value) {
                    return undefined
                }

                const parsedTags = value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)

                return parsedTags.length > 0 ? parsedTags : undefined
            }),
        sortBy: z.enum(['name', 'budget', 'duration', 'startDate', 'createdAt']).default('createdAt'),
        order: z.enum(['asc', 'desc']).default('desc'),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(10),
    })
    .refine(
        (data) => !(data.minBudget !== undefined && data.maxBudget !== undefined && data.minBudget > data.maxBudget),
        {
            message: 'minBudget cannot be greater than maxBudget',
            path: ['minBudget'],
        }
    )
    .refine(
        (data) =>
            !(data.minDuration !== undefined && data.maxDuration !== undefined && data.minDuration > data.maxDuration),
        {
            message: 'minDuration cannot be greater than maxDuration',
            path: ['minDuration'],
        }
    )

// Review schema
export const createReviewSchema = z.object({
    packageId: z.string().min(1, "Package ID is required"),
    review: z.string().min(1, "Review is required"),
    rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
})

// TypeScript types
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type CreatePackageInput = z.infer<typeof createPackageSchema>
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>
export type CreateHotelInput = z.infer<typeof createHotelSchema>
export type UpdateHotelInput = z.infer<typeof updateHotelSchema>
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>
export type SortPackageInput = z.infer<typeof sortPackageSchema>
export type CreateReviewInput = z.infer<typeof createReviewSchema>
