export const toIdString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'toString' in value) {
    return String(value)
  }

  return ''
}

export const isObjectIdString = (value: string): boolean => /^[a-f\d]{24}$/i.test(value)
