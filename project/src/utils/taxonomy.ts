/**
 * taxonomy.ts
 *
 * Oomap 검색용 분류 사전. 서로 섞이지 않게 세 가지로 나눈다.
 * - place_type: 장소 종류 (카페·미술관·공원·거리 …) — 한 장소에 여러 개
 * - reason:     추천하는 이유·하는 일 (커피·전망·작업·산책 …)
 * - situation:  이런 때 잘 맞아요 (비 오는 날·아이와 함께·평일 오후 …)
 *
 * 혼자/둘이/여럿이, 점심/저녁/늦은 밤, 조용한 곳 같은 상황은 기존 추천 조건(intentChips)이 이미 다루므로
 * 여기서는 중복으로 만들지 않는다.
 *
 * 같은 사전이 DB에도 있다: admin/supabase/migrations/019_backfill_curation_model.sql 의 taxonomy_terms seed.
 * slug를 바꾸면 양쪽을 같이 바꾼다 (admin/tests/migrations/curation-model.test.ts 가 맞는지 확인한다).
 */

import type { ContentMode, Location } from '../types/location';

export type TermKind = 'place_type' | 'reason' | 'situation';

export interface TaxonomyTerm {
  slug: string;
  kind: TermKind;
  /** 화면에 보이는 이름 */
  label: string;
  /** 주로 어느 데이터에 있는지. 'both'면 맛집·볼거리 모두 */
  mode: ContentMode | 'both';
  /** 사용자가 적은 문장에서 이 분류를 알아보는 말. 비우면 문장 해석에 쓰지 않는다 */
  query?: RegExp;
  /** 기존 태그 중 이 분류의 근거로 볼 수 있는 것 (공백 무시 비교) */
  tagHints?: string[];
  /** 기존 category_main / category_sub 중 이 분류에 해당하는 것 */
  categoryHints?: string[];
  /** 운영자가 쓴 문장에서 근거로 찾을 말 */
  textHints?: string[];
  /**
   * 추천 조건 칩에 따로 넣지 않는 분류. 혼자·데이트·모임·조용함은 기존 조건(누구와·분위기)이 이미 다룬다.
   * DB 분류와 상세 화면 '이런 때 잘 맞아요'에는 그대로 쓴다.
   */
  coveredByConditions?: boolean;
}

export const TAXONOMY: TaxonomyTerm[] = [
  // ── 장소 종류 ──
  { slug: 'cafe', kind: 'place_type', label: '카페', mode: 'food', categoryHints: ['카페'] },
  { slug: 'bakery', kind: 'place_type', label: '베이커리·디저트', mode: 'food', categoryHints: ['디저트'], tagHints: ['베이커리카페', '디저트카페'] },
  { slug: 'restaurant', kind: 'place_type', label: '식당', mode: 'food', categoryHints: ['밥', '면', '국물', '고기요리', '해산물', '간편식', '양식', '양식·퓨전', '돈까스', '라멘', '치킨'] },
  { slug: 'bar', kind: 'place_type', label: '술집', mode: 'food', categoryHints: ['술안주', '술집'], tagHints: ['칵테일바', '피맥', '수제맥주'] },
  { slug: 'museum', kind: 'place_type', label: '박물관', mode: 'space', query: /박물관/, categoryHints: ['박물관'] },
  { slug: 'gallery', kind: 'place_type', label: '미술관·전시관', mode: 'space', query: /전시|미술관|갤러리/, categoryHints: ['미술관', '전시관', '복합문화공간'], tagHints: ['미술관', '전시', '전시회', '전시장', '무료전시', '현대미술'] },
  { slug: 'park', kind: 'place_type', label: '공원·정원', mode: 'space', query: /공원|정원|수목원|식물원/, categoryHints: ['공원/정원', '식물원/수목원', '산/등산'] },
  { slug: 'street', kind: 'place_type', label: '거리·동네', mode: 'space', query: /(?<![볼먹놀살])거리|골목/, textHints: ['거리', '골목'] },
  { slug: 'bookstore', kind: 'place_type', label: '서점·도서관', mode: 'space', query: /서점|책방|도서관/, categoryHints: ['독립서점', '도서관'], tagHints: ['독립서점', '도서관'] },
  { slug: 'shop', kind: 'place_type', label: '소품샵·편집숍', mode: 'space', query: /소품|편집숍|편집샵|문구/, categoryHints: ['소품샵', '문구점', '라이프스타일숍', '편집샵'], tagHints: ['소품샵'] },
  { slug: 'viewpoint', kind: 'place_type', label: '전망대', mode: 'space', query: /전망대/, categoryHints: ['전망대'] },
  { slug: 'heritage', kind: 'place_type', label: '궁궐·유적', mode: 'space', query: /고궁|궁궐|유적/, categoryHints: ['역사/유적', '궁궐/왕릉', '유적지', '사찰'] },
  { slug: 'market', kind: 'place_type', label: '시장', mode: 'space', query: /시장/, categoryHints: ['전통시장'] },

  // ── 추천하는 이유 ──
  { slug: 'coffee', kind: 'reason', label: '커피', mode: 'food', query: /커피|라떼|드립|원두/, tagHints: ['커피 맛집', '커피', '핸드드립전문점', '로스팅전문', '스페셜티카페'], textHints: ['커피', '원두', '드립', '라떼'] },
  { slug: 'dessert', kind: 'reason', label: '디저트·빵', mode: 'food', query: /디저트|케이크|빵/, tagHints: ['수제케이크', '수제디저트', '소금빵', '빵지순례', '에그타르트', '휘낭시에', '케이크', '디저트', '구움과자', '마들렌'], textHints: ['케이크', '빵', '디저트', '타르트', '쿠키'] },
  { slug: 'food', kind: 'reason', label: '음식 맛', mode: 'food', textHints: ['맛있', '맛집'] },
  { slug: 'view', kind: 'reason', label: '전망·뷰', mode: 'both', query: /전망|(?<!리)뷰|야경|루프탑|한강/, tagHints: ['한강뷰', '루프탑있는', '야경'], categoryHints: ['전망대'], textHints: ['전망', '뷰', '야경', '창밖', '통창', '풍경', '루프탑', '한강'] },
  { slug: 'work', kind: 'reason', label: '작업·공부', mode: 'food', query: /노트북|작업|공부|카공/, tagHints: ['작업하기 좋음'], categoryHints: ['카공카페'], textHints: ['작업', '노트북', '콘센트', '공부', '카공'] },
  { slug: 'walk', kind: 'reason', label: '산책', mode: 'space', query: /산책|걷기/, tagHints: ['산책', '산책로'], textHints: ['산책', '걷기'] },
  { slug: 'exhibition', kind: 'reason', label: '전시 보기', mode: 'space', tagHints: ['전시', '전시회', '체험형전시', '무료전시', '현대미술'], textHints: ['전시', '작품'] },
  { slug: 'photo', kind: 'reason', label: '사진 찍기', mode: 'both', query: /사진|포토|인생샷/, tagHints: ['포토존', '사진맛집', '포토스팟'], textHints: ['사진'] },
  { slug: 'mood', kind: 'reason', label: '분위기', mode: 'both', tagHints: ['분위기', '감성카페', '분위기좋은', '빈티지분위기', '앤틱한', '감성', '아늑한분위기'], textHints: ['분위기', '감성'] },
  { slug: 'books', kind: 'reason', label: '책 읽기', mode: 'space', query: /책 ?읽|독서/, tagHints: ['책 많음', '독립서점'], textHints: ['책'] },
  { slug: 'browse', kind: 'reason', label: '구경·쇼핑', mode: 'space', query: /구경|쇼핑/, tagHints: ['소품 다양', '쇼핑', '선물'], textHints: ['구경', '소품'] },
  { slug: 'nature', kind: 'reason', label: '꽃·자연', mode: 'space', query: /꽃|단풍|자연|수목|(?<!서울)숲/, tagHints: ['벚꽃명소', '벚꽃길', '단풍명소', '장미명소', '꽃', '온실', '식물원'], textHints: ['꽃', '단풍', '숲'] },

  // ── 이런 때 잘 맞아요 ──
  { slug: 'solo', kind: 'situation', label: '혼자', mode: 'both', coveredByConditions: true, tagHints: ['혼밥', '혼밥 가능', '혼술'], textHints: ['혼자', '혼밥'] },
  { slug: 'date', kind: 'situation', label: '데이트', mode: 'both', coveredByConditions: true, tagHints: ['데이트', '데이트코스', '소개팅', '실내데이트', '홍대데이트'], textHints: ['데이트'] },
  { slug: 'gathering', kind: 'situation', label: '여럿이 모일 때', mode: 'both', coveredByConditions: true, tagHints: ['모임', '친목모임', '회식', '단체'], textHints: ['모임', '회식'] },
  { slug: 'quiet', kind: 'situation', label: '조용히 있고 싶을 때', mode: 'both', coveredByConditions: true, tagHints: ['조용함', '조용한 분위기', '조용한'], textHints: ['조용'] },
  { slug: 'rainy_day', kind: 'situation', label: '비 오는 날', mode: 'both', query: /비 ?오는|비 ?올|우천|비올/, tagHints: ['실내', '실내데이트', '실내놀거리'], textHints: ['비 오는', '실내'] },
  { slug: 'weekday_afternoon', kind: 'situation', label: '평일 오후', mode: 'both', query: /평일/, textHints: ['평일'] },
  { slug: 'with_kids', kind: 'situation', label: '아이와 함께', mode: 'both', query: /아이와|아이랑|아이들|아기|어린이|키즈|애들/, tagHints: ['아이와함께', '어린이'], textHints: ['아이'] },
  { slug: 'with_family', kind: 'situation', label: '가족과', mode: 'both', query: /가족|부모님/, tagHints: ['가족', '가족나들이'], textHints: ['가족', '부모님'] },
  { slug: 'with_pet', kind: 'situation', label: '반려견과', mode: 'both', query: /강아지|반려견|애견|반려동물/, tagHints: ['반려견동반', '애견동반카페'], textHints: ['강아지', '반려견'] },
  { slug: 'gift', kind: 'situation', label: '선물 고를 때', mode: 'both', query: /선물/, tagHints: ['선물하기 좋음', '선물'], textHints: ['선물'] },
];

const BY_SLUG = new Map(TAXONOMY.map((term) => [term.slug, term]));

export function getTerm(slug: string): TaxonomyTerm | undefined {
  return BY_SLUG.get(slug);
}

export function termLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}

/** 추천 조건 칩에 보여줄 분류 (기존 조건과 겹치는 것은 뺀다) */
export function termsOf(kind: TermKind, mode?: ContentMode): TaxonomyTerm[] {
  return TAXONOMY.filter(
    (term) => term.kind === kind && !term.coveredByConditions && (!mode || term.mode === 'both' || term.mode === mode),
  );
}

/** 문장에서 분류를 찾는다. 확실한 말이 없으면 비워 둔다 (억지로 붙이지 않는다) */
export function findTermsInText(text: string, kind: TermKind): string[] {
  return TAXONOMY.filter((term) => term.kind === kind && term.query?.test(text)).map((term) => term.slug);
}

// ─────────────────────────────────────────────
// 장소에서 근거 찾기
// ─────────────────────────────────────────────

const squash = (text: string) => text.toLowerCase().replace(/\s+/g, '');

type EvidenceFields = Pick<Location, 'tags' | 'categoryMain' | 'categorySub'>;

/**
 * 이 장소가 분류에 해당하는 근거. 없으면 null.
 * 순서: 운영자가 쓴 문장 → 기존 분류(category) → 태그. 근거 문구에 출처가 보이게 돌려준다.
 */
export function findTermEvidence(location: EvidenceFields, slug: string, operatorText = ''): string | null {
  const term = BY_SLUG.get(slug);
  if (!term) return null;

  if (term.kind !== 'place_type' && operatorText) {
    const hint = term.textHints?.find((word) => operatorText.includes(word));
    if (hint) return `추천하는 이유에 '${hint}'`;
  }

  const category = [location.categorySub, location.categoryMain].find(
    (value) => value && term.categoryHints?.includes(value),
  );
  if (category) return `등록 분류: ${category}`;

  const hints = (term.tagHints ?? []).map(squash);
  const tag = location.tags?.find((value) => hints.includes(squash(value)));
  return tag ? `#${tag}` : null;
}

export interface TermMatch {
  slug: string;
  label: string;
  evidence: string;
}

/** 상세 화면용: 이 장소에서 근거가 있는 장소 종류·이유·상황. 근거 없는 분류는 넣지 않는다 */
export function describePlace(location: EvidenceFields, operatorText = ''): Record<TermKind, TermMatch[]> {
  const result: Record<TermKind, TermMatch[]> = { place_type: [], reason: [], situation: [] };
  for (const term of TAXONOMY) {
    const evidence = findTermEvidence(location, term.slug, operatorText);
    if (evidence) result[term.kind].push({ slug: term.slug, label: term.label, evidence });
  }
  return result;
}
