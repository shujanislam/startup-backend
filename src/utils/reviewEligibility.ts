const REVIEW_DELAY_DAYS = 3
const REVIEW_DELAY_MS = REVIEW_DELAY_DAYS * 24 * 60 * 60 * 1000

export const buildReviewEligibility = (revealRecord: { createdAt: Date } | null) => {
  if (!revealRecord) {
    return {
      revealed: false,
      revealedAt: null as Date | null,
      canReview: false,
      reviewAvailableAt: null as Date | null,
      daysRemaining: null as number | null,
      status: 'locked' as 'locked' | 'cooldown' | 'eligible',
    }
  }

  const revealedAt = new Date(revealRecord.createdAt)
  const reviewAvailableAt = new Date(revealedAt.getTime() + REVIEW_DELAY_MS)
  const now = Date.now()
  const canReview = now >= reviewAvailableAt.getTime()
  const daysRemaining = canReview
    ? 0
    : Math.ceil((reviewAvailableAt.getTime() - now) / (24 * 60 * 60 * 1000))

  return {
    revealed: true,
    revealedAt,
    canReview,
    reviewAvailableAt,
    daysRemaining,
    status: canReview ? 'eligible' : 'cooldown',
  }
}
