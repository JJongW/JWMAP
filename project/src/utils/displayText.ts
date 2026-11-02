/**
 * displayText.ts
 *
 * 저장된 값(필터·검색·추천에 쓰는 키)은 그대로 두고, 화면에 보이는 이름만 바꾼다.
 * 가운데점(U+00B7)으로 이어 쓴 분류·지역 값을 사람이 읽는 말로 풀어 쓴다.
 */

/** 분류 값 → 화면 이름. DB의 category_main '양식·퓨전'은 필터 키라 그대로 둔다 */
const CATEGORY_LABEL: Record<string, string> = {
  '양식·퓨전': '양식과 퓨전',
};

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return '';
  return CATEGORY_LABEL[value] ?? value;
}

const REGION_JOINER = ' · ';

/**
 * 지역 값 → 화면 이름. 검토함에서 들어온 '관악구 · 봉천'(구 + 동네) 형식은 '관악구 봉천'으로,
 * '의정부 · 의정부'처럼 같은 이름이 겹치면 한 번만 쓴다. 지역 필터 값은 그대로다.
 */
export function regionLabel(value: string | null | undefined): string {
  if (!value) return '';
  if (!value.includes(REGION_JOINER)) return value;
  const parts = value.split(REGION_JOINER).map((part) => part.trim()).filter(Boolean);
  return [...new Set(parts)].join(' ');
}
