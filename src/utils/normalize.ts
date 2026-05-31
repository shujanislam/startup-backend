export const hasMeaningfulValue = (value: unknown): boolean => {
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

export const normalizeStringList = (items?: string[]) =>
  (items ?? []).map((item) => item.trim()).filter(Boolean)

export const normalizeObjectIdList = (items: unknown[] | undefined) =>
  (items ?? [])
    .map((item) => String(item))
    .filter(Boolean)
