type FeaturedScoreInput = {
  monthlyViews: number
  likesLast7Days: number
  avgRatingLast7Days: number
  reviewCountLast7Days: number
  createdAt: Date
}

type MaxMetrics = {
  monthlyViews: number
  likesLast7Days: number
}

const normalize = (value: number, max: number): number => {
  if (max <= 0) {
    return 0
  }

  return value / max
}

const getAgeInDays = (createdAt: Date): number => {
  const ageMs = Date.now() - createdAt.getTime()
  return Math.max(1, ageMs / (24 * 60 * 60 * 1000))
}

const getFreshnessScore = (createdAt: Date): number => {
  const ageInDays = getAgeInDays(createdAt)
  const freshnessWindowDays = 30
  return Math.max(0, 1 - ageInDays / freshnessWindowDays)
}

const getRatingConfidenceScore = (avgRating: number, reviewCount: number): number => {
  const boundedRating = Math.min(5, Math.max(0, avgRating))
  const confidence = Math.min(1, reviewCount / 5)
  return (boundedRating / 5) * confidence
}

export const computeFeaturedPackageScore = (
  input: FeaturedScoreInput,
  maxMetrics: MaxMetrics,
): number => {
  const normalizedMonthlyViews = normalize(input.monthlyViews, maxMetrics.monthlyViews)
  const normalizedLikes = normalize(input.likesLast7Days, maxMetrics.likesLast7Days)
  const ratingConfidence = getRatingConfidenceScore(input.avgRatingLast7Days, input.reviewCountLast7Days)
  const freshness = getFreshnessScore(input.createdAt)

  return (
    0.55 * normalizedMonthlyViews +
    0.25 * normalizedLikes +
    0.15 * ratingConfidence +
    0.05 * freshness
  )
}

export const getCurrentMonthKey = (): string => {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
