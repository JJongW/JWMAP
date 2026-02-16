const NOISE_TAGS = new Set(['맛집', '추천', '식당', '음식점', '장소']);

function normalizeTag(tag: string): string {
  return tag
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 30);
}

export function validateTags(tags: string[], options?: { max?: number }): {
  validTags: string[];
  invalidTags: string[];
} {
  const max = options?.max ?? 12;
  const validSet = new Set<string>();
  const invalid: string[] = [];

  for (const rawTag of tags) {
    const normalized = normalizeTag(rawTag);
    if (!normalized || normalized.length < 2 || NOISE_TAGS.has(normalized.toLowerCase())) {
      if (rawTag.trim()) invalid.push(rawTag);
      continue;
    }

    validSet.add(normalized);
    if (validSet.size >= max) break;
  }

  return {
    validTags: [...validSet],
    invalidTags: invalid,
  };
}
