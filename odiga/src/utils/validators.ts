export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0;
}

export function sanitizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').slice(0, 500);
}
