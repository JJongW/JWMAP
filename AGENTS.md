# AI Agent Rules - JWMAP

이 문서는 AI 에이전트가 JWMAP 프로젝트에서 작업할 때 반드시 따라야 할 규칙입니다.

## 1. 프로젝트 정체성

- **서비스 특성**: 개인이 직접 방문하고 검증한 장소만 수록하는 큐레이션 서비스
- **서비스 범위**: 서울 및 수도권 (확장 중)
- **핵심 가치**: 빠른 의사결정 → 바로 출발
- **차별점**: 대규모 발견이 아닌 큐레이션 + 결정 속도

## 2. 핵심 UX 플로우 (불변)

```
1. 사용자가 장소 탐색
   - 지역/카테고리 필터 또는
   - 자연어 검색 (LLM)

2. 장소 목록 표시

3. 지도에서 선택한 장소 프리뷰

4. 사용자 탭:
   - PC → 웹 지도 페이지
   - 모바일 → 네이버/카카오 앱 딥링크
```

**이 플로우는 절대 변경하거나 대체해서는 안 됩니다.**

## 3. 데이터 규칙 (필수)

### LLM은 장소를 생성하지 않습니다
- 모든 검색 결과는 반드시 `locations` 테이블에서 가져옵니다
- LLM은 쿼리 해석기 역할만 수행합니다
- 결과가 없으면 빈 배열 반환 + UX 힌트 표시

### 결과 없음 처리
```typescript
// 올바른 처리
if (results.length === 0) {
  return {
    places: [],
    message: "용산에는 아직 등록된 곳이 없어요"
  };
}

// 잘못된 처리 - 절대 금지
// LLM이 장소를 생성하거나 추천하는 것
```

## 4. LLM 사용 정책

### LLM의 역할
- 쿼리 인터프리터 (Query Interpreter)
- 자연어 → 구조화된 JSON 변환만 수행
- 설명, 추천, 의견 제공 금지

### LLM 출력 스키마
```typescript
interface LLMQuery {
  region?: string[];           // 지역 필터
  subRegion?: string[];        // 세부 지역
  categoryMain?: string[];     // 카테고리 대분류
  categorySub?: string[];      // 카테고리 소분류
  excludeCategoryMain?: string[]; // 제외할 카테고리
  keywords?: string[];         // 키워드/태그
  constraints?: {
    solo_ok?: boolean;         // 혼밥 가능
    quiet?: boolean;           // 조용한
    no_wait?: boolean;         // 웨이팅 없음
    price_level?: number;      // 가격대 1-4
  };
  sort?: 'relevance' | 'rating';
}
```

### 검색 파이프라인 (고정)
1. 구조화된 필터 (region, category)
2. 태그/키워드 매칭
3. Constraints 필터링
4. 규칙 기반 정렬: 태그 매치 > 평점
5. **LLM은 결과 순위를 매기지 않습니다**

## 5. 지도 연동 규칙

### 딥링크 우선순위
1. `placeId`가 있으면 딥링크 사용
2. 없으면 좌표 기반 fallback
3. 앱 미설치 시 웹 지도로 fallback

### 플랫폼별 처리
```typescript
// PC: 웹 지도
window.open(webMapUrl, '_blank');

// 모바일: 앱 딥링크 시도 → 700ms 후 웹 fallback
const timer = setTimeout(() => window.open(webUrl), 700);
window.location.href = appDeeplink;
```

### 딥링크는 사용자 상호작용으로만 트리거
- 자동 리다이렉트 금지
- 반드시 클릭/탭 이벤트 핸들러 내에서 실행

## 6. 기술 제약

### 스택
- **React 18 + TypeScript + Vite** (Next.js 아님)
- 클라이언트 사이드 렌더링
- Vercel Serverless Functions (API)

### 코드 규칙
```typescript
// 올바른 패턴: Vite 환경변수
const apiKey = import.meta.env.VITE_KAKAO_APP_API_KEY;

// 잘못된 패턴: Next.js 스타일
const apiKey = process.env.NEXT_PUBLIC_KAKAO_KEY; // 사용 금지

// 올바른 패턴: window는 항상 클라이언트에서 접근
const isMobile = window.innerWidth < 768;

// Supabase 필드 변환
// DB (snake_case) ↔ App (camelCase)
const imageUrl = item.image_url || item.imageUrl;
```

### 불필요한 라이브러리 추가 금지
- 기존 의존성으로 해결 가능하면 새 라이브러리 추가하지 않음
- 추가 시 반드시 이유 명시

## 7. 코드 작성 지침

### 프로덕션 수준 코드
- 에러 핸들링 필수
- 타입 안전성 보장
- 콘솔 로그는 개발용만 사용

### 파일 수정 시 체크리스트
- [ ] TypeScript 빌드 통과 (`npm run build`)
- [ ] ESLint 경고 없음 (`npm run lint`)
- [ ] 기존 기능 동작 확인
- [ ] snake_case ↔ camelCase 변환 확인

### 금지 사항
- `any` 타입 남용
- 하드코딩된 값 (환경변수 또는 상수 사용)
- 주석 없는 복잡한 로직
- 사용하지 않는 import/변수

## 8. 프롬프트 계약

이 파일이 존재할 때:
- 이 규칙들을 프롬프트에서 반복하지 않음
- 프롬프트에는 다음만 포함:
  - 목표 (Goal)
  - 변경사항/산출물 (Delta/Deliverables)
- 이 문서의 규칙이 항상 적용됨을 가정

## 9. 자주 하는 실수 방지

### 카테고리 처리
```typescript
// 올바른 패턴: 대분류에서 소분류 추론
const mainFromSub = getMainFromSub(location.categorySub);

// 잘못된 패턴: 레거시 category 필드만 의존
const category = location.category; // 레거시 호환용
```

### 검색 결과 처리
```typescript
// 올바른 패턴: 태그 매치 우선 정렬
results.sort((a, b) => {
  const aMatch = tagMatchedIds.has(a.id) ? 1 : 0;
  const bMatch = tagMatchedIds.has(b.id) ? 1 : 0;
  if (aMatch !== bMatch) return bMatch - aMatch;
  return b.rating - a.rating;
});

// 잘못된 패턴: 평점만으로 정렬
results.sort((a, b) => b.rating - a.rating);
```

### 이미지 URL 처리
```typescript
// 올바른 패턴: 두 필드명 모두 체크
const imageUrl = item.image_url || item.imageUrl || '';

// 잘못된 패턴: 한 필드만 체크
const imageUrl = item.imageUrl; // image_url 누락 가능
```

## 10. 주요 파일 위치

| 용도 | 경로 |
|------|------|
| 메인 앱 | `project/src/App.tsx` |
| 타입 정의 | `project/src/types/location.ts` |
| Supabase API | `project/src/utils/supabase.ts` |
| LLM 검색 API | `project/api/search.ts` |
| 지도 컴포넌트 | `project/src/components/Map.tsx` |
| 장소 카드 | `project/src/components/LocationCard.tsx` |
| 장소 추가 | `project/src/components/AddLocationModal.tsx` |
