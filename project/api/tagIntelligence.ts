export type SearchConstraintFlag = {
  solo_ok?: boolean;
  quiet?: boolean;
  no_wait?: boolean;
};

export type TagSuggestionType =
  | 'theme'
  | 'season'
  | 'occasion'
  | 'vibe'
  | 'food'
  | 'place'
  | 'constraint'
  | 'general';

export interface RawTagSuggestion {
  name: string;
  type: TagSuggestionType;
  weight: number;
}

interface CanonicalTagRule {
  canonical: string;
  type: TagSuggestionType;
  aliases: string[];
  flags?: SearchConstraintFlag;
}

const GENERIC_TAGS = new Set([
  '맛집',
  '추천',
  '식당',
  '음식점',
  '가게',
  '장소',
  '여기',
  '저기',
  '알려줘',
  '보여줘',
]);

const CANONICAL_TAG_RULES: CanonicalTagRule[] = [
  {
    canonical: '혼밥',
    type: 'occasion',
    aliases: ['혼자', '1인', '혼밥가능', '혼자밥', '혼자식사'],
    flags: { solo_ok: true },
  },
  {
    canonical: '혼술',
    type: 'occasion',
    aliases: ['혼자술', '1인술'],
    flags: { solo_ok: true },
  },
  {
    canonical: '조용한 분위기',
    type: 'vibe',
    aliases: ['조용한', '한적한', '시끄럽지않은', '차분한'],
    flags: { quiet: true },
  },
  {
    canonical: '웨이팅 적음',
    type: 'constraint',
    aliases: ['웨이팅없음', '웨이팅 없는', '바로입장', '대기없음', '대기 짧음'],
    flags: { no_wait: true },
  },
  {
    canonical: '예약 가능',
    type: 'constraint',
    aliases: ['예약가능', '예약필수', '예약됨'],
  },
  {
    canonical: '주차 가능',
    type: 'constraint',
    aliases: ['주차가능', '주차됨', '주차편함'],
  },
  {
    canonical: '데이트',
    type: 'occasion',
    aliases: ['데이트하기좋은', '데이트코스', '커플'],
  },
  {
    canonical: '벚꽃',
    type: 'theme',
    aliases: ['벚꽃명소', '벚꽃필때', '봄꽃'],
  },
  {
    canonical: '단풍',
    type: 'theme',
    aliases: ['단풍명소', '가을단풍'],
  },
  {
    canonical: '봄',
    type: 'season',
    aliases: ['봄날', '봄시즌'],
  },
  {
    canonical: '비오는날',
    type: 'season',
    aliases: ['비오는 날', '우천', '우중'],
  },
  {
    canonical: '산책',
    type: 'place',
    aliases: ['걷기좋은', '산책코스'],
  },
  {
    canonical: '포토스팟',
    type: 'place',
    aliases: ['사진찍기좋은', '인생샷'],
  },
  {
    canonical: '야경',
    type: 'place',
    aliases: ['야경명소', '밤풍경'],
  },
  {
    canonical: '카공',
    type: 'occasion',
    aliases: ['카공하기좋은', '작업하기좋은', '노트북가능'],
  },
  {
    canonical: '가성비',
    type: 'general',
    aliases: ['가격착한', '저렴한', '합리적인가격'],
  },
  {
    canonical: '심야 영업',
    type: 'constraint',
    aliases: ['늦게까지', '새벽영업', '야식'],
  },
  {
    canonical: '브런치',
    type: 'food',
    aliases: ['브런치카페'],
  },
  {
    canonical: '디저트',
    type: 'food',
    aliases: ['달달한', '후식'],
  },
  {
    canonical: '카페',
    type: 'place',
    aliases: ['커피', '카페투어'],
  },
  {
    canonical: '볼거리',
    type: 'place',
    aliases: ['전시', '팝업', '소품샵'],
  },
  {
    canonical: '매콤한',
    type: 'food',
    aliases: ['매운', '매운맛'],
  },
  {
    canonical: '담백한',
    type: 'food',
    aliases: ['깔끔한맛'],
  },
];

const aliasToCanonical = new Map<string, CanonicalTagRule>();
for (const rule of CANONICAL_TAG_RULES) {
  aliasToCanonical.set(rule.canonical.toLowerCase(), rule);
  for (const alias of rule.aliases) {
    aliasToCanonical.set(alias.toLowerCase(), rule);
  }
}

export function normalizeTagName(tag: string): string {
  return tag
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 30);
}

export function canonicalizeTag(tag: string): {
  name: string;
  type: TagSuggestionType;
  flags: SearchConstraintFlag;
} {
  const normalized = normalizeTagName(tag);
  const rule = aliasToCanonical.get(normalized.toLowerCase());
  if (!rule) {
    return { name: normalized, type: 'general', flags: {} };
  }

  return {
    name: rule.canonical,
    type: rule.type,
    flags: rule.flags || {},
  };
}

function isMeaningfulTag(tag: string): boolean {
  if (!tag || tag.length < 2) return false;
  return !GENERIC_TAGS.has(tag.toLowerCase());
}

export function sanitizeTagNames(tags: string[], options?: { max?: number; banned?: string[] }): string[] {
  const max = options?.max ?? 12;
  const banned = new Set((options?.banned || []).map((word) => normalizeTagName(word).toLowerCase()));
  const dedup = new Set<string>();

  for (const rawTag of tags) {
    const normalized = normalizeTagName(rawTag);
    if (!normalized) continue;
    if (banned.has(normalized.toLowerCase())) continue;

    const { name } = canonicalizeTag(normalized);
    if (!isMeaningfulTag(name)) continue;

    dedup.add(name);
    if (dedup.size >= max) break;
  }

  return [...dedup];
}

export function sanitizeTagSuggestions(
  tags: RawTagSuggestion[],
  options?: { max?: number; placeName?: string; category?: string }
): RawTagSuggestion[] {
  const max = options?.max ?? 12;
  const banned = [options?.placeName || '', options?.category || ''];
  const dedup = new Map<string, RawTagSuggestion>();

  for (const raw of tags) {
    const normalized = normalizeTagName(raw.name);
    if (!normalized) continue;

    const canonical = canonicalizeTag(normalized);
    const lowerName = canonical.name.toLowerCase();
    const isBanned = banned.some((item) => normalizeTagName(item).toLowerCase() === lowerName);
    if (isBanned || !isMeaningfulTag(canonical.name)) continue;

    const weight = Math.min(1, Math.max(0, raw.weight));
    const current = dedup.get(canonical.name);
    const candidate: RawTagSuggestion = {
      name: canonical.name,
      type: canonical.type || raw.type || 'general',
      weight,
    };

    if (!current || current.weight < candidate.weight) {
      dedup.set(canonical.name, candidate);
    }
  }

  return [...dedup.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max);
}

export function inferConstraintFlagsFromKeywords(keywords: string[]): SearchConstraintFlag {
  const merged: SearchConstraintFlag = {};

  for (const rawKeyword of keywords) {
    const keyword = normalizeTagName(rawKeyword);
    if (!keyword) continue;
    const canonical = canonicalizeTag(keyword);
    if (canonical.flags.solo_ok) merged.solo_ok = true;
    if (canonical.flags.quiet) merged.quiet = true;
    if (canonical.flags.no_wait) merged.no_wait = true;
  }

  return merged;
}

export function expandKeywordsForTagSearch(keywords: string[]): string[] {
  const expanded = new Set<string>();

  for (const rawKeyword of keywords) {
    const keyword = normalizeTagName(rawKeyword);
    if (!keyword) continue;

    expanded.add(keyword);

    const rule = aliasToCanonical.get(keyword.toLowerCase());
    if (rule) {
      expanded.add(rule.canonical);
      for (const alias of rule.aliases) {
        expanded.add(alias);
      }
    }
  }

  return [...expanded];
}
