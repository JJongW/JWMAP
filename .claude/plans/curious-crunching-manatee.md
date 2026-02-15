# 평점(rating) 제거 → 태그/쩝쩝박사 라벨 기반 스코어링으로 전환

## Context

현재 스코어링에서 `popularity` 컴포넌트가 `rating / 5.0`으로 계산됨 (가중치 15%).
프론트엔드에서도 rating을 curation_level 변환 fallback으로 사용 중.
사용자 요청: 평점 기반 매칭 제거, 태그/쩝쩝박사 라벨(curation_level) 기반으로 전환.

## 변경 사항

### 1. odiga-api 스코어링 변경

**`odiga-api/lib/scoring.ts`**
- `popularityScore()` 함수: `rating / 5.0` → `curation_level / 5.0` 로 변경 (이름을 `curationScore`로 변경)
- `scoreBreakdown`에서 `popularity` → `curation` 으로 이름 변경
- `ScoredPlace.scoreBreakdown` 인터페이스 업데이트

**`odiga-api/lib/scoringConfig.ts`**
- `ScoringWeights`에서 `popularity` → `curation`으로 이름 변경

**`odiga-api/lib/places.ts`**
- `Place` 인터페이스에 `curation_level?: number` 추가
- DB 쿼리 `.order('rating')` → `.order('curation_level')` 변경

### 2. odiga CLI 표시 변경

**`odiga/src/ui/renderer.ts`**
- `renderPlaceSummary()`: `⭐ 평점` 제거, 태그 표시 추가
- `renderPlaceDetail()`: `⭐ rating` 라인 제거, 쩝쩝박사 라벨(curation_level) 표시
- `renderCourseDetail()`: `⭐ rating` 라인 제거
- `renderGuide()`: "인기" → "큐레이션" 등 설명 업데이트

**`odiga/src/api/types.ts`**
- `Place` 인터페이스에 `curation_level?: number` 추가
- `scoreBreakdown.popularity` → `scoreBreakdown.curation`

### 3. 프론트엔드 rating 제거

**`project/src/types/location.ts`**
- `rating: number` → `rating?: number` (optional로 하위호환, DB에 아직 있으므로)

**`project/src/utils/supabase.ts`**
- fallback 정렬에서 `rating` → `curation_level` 변경

**`project/src/components/LocationCard.tsx`**
- rating 참조 제거, `curation_level` 직접 사용 (fallback 불필요하면 기본값 1)

**`project/src/components/PlaceDetail.tsx`**
- `ratingToCurationLevel` fallback 제거, `curation_level ?? 1` 로 단순화

**`project/src/components/BrowseView.tsx`**
- 동일하게 `ratingToCurationLevel` fallback 제거

**`project/src/components/DecisionResultView.tsx`**
- 동일하게 `ratingToCurationLevel` fallback 제거

**`project/src/utils/curation.ts`**
- `ratingToCurationLevel()` 함수는 유지 (하위호환, 기존 DB 데이터)

## 수정 파일 목록

| 파일 | 변경 |
|------|------|
| `odiga-api/lib/scoring.ts` | popularity → curation 기반, curation_level 사용 |
| `odiga-api/lib/scoringConfig.ts` | popularity → curation 이름 변경 |
| `odiga-api/lib/places.ts` | Place에 curation_level 추가, 정렬 변경 |
| `odiga/src/api/types.ts` | Place에 curation_level 추가, breakdown 변경 |
| `odiga/src/ui/renderer.ts` | ⭐ 평점 제거, 태그/라벨 표시 |
| `project/src/types/location.ts` | rating optional로 변경 |
| `project/src/utils/supabase.ts` | fallback 정렬 변경 |
| `project/src/components/LocationCard.tsx` | rating fallback 제거 |
| `project/src/components/PlaceDetail.tsx` | rating fallback 제거 |
| `project/src/components/BrowseView.tsx` | rating fallback 제거 |
| `project/src/components/DecisionResultView.tsx` | rating fallback 제거 |

## 검증

1. `cd project && npm run build` — 타입 에러 없이 빌드
2. `cd odiga && npx tsc -p tsconfig.json --noEmit` — CLI 타입 체크
3. CLI 출력에 ⭐ 평점 없고, 태그/쩝쩝박사 라벨 표시 확인
