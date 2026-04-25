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
    createdBy: z.string().min(1, "CreatedBy is required"),
    hotels: z.array(z.string()).default([]),
    vehicles: z.array(z.string()).default([]),
})

export const updatePackageSchema = createPackageSchema.partial()

// Review schema
export const createReviewSchema = z.object({
    packageId: z.string().min(1, "Package ID is required"),
    userId: z.string().min(1, "User ID is required"),
    review: z.string().min(1, "Review is required"),
    rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
})

// TypeScript types
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type CreatePackageInput = z.infer<typeof createPackageSchema>
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>
export type CreateReviewInput = z.infer<typeof createReviewSchema>