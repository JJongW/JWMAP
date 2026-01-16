---
name: task-automation
description: JWMAP 프로젝트의 반복 작업을 자동화합니다. 새 지역/카테고리 추가, DB 마이그레이션, 빌드/배포, 타입 생성 등의 작업에 사용합니다.
---

# 작업 자동화 가이드

## 자동화 가능한 작업 목록

### 1. 새 카테고리 추가

**수행 파일:**
- `src/types/location.ts` - Category 타입에 추가
- `src/components/AddLocationModal.tsx` - categories 배열에 추가
- `src/components/LocationCard.tsx` - categories 배열에 추가

**자동화 단계:**
```
1. location.ts의 Category 타입에 새 카테고리 추가
2. AddLocationModal.tsx의 categories 배열에 추가
3. LocationCard.tsx의 categories 배열에 추가
4. TypeScript 빌드 확인
```

---

### 2. 새 지역 추가

**수행 파일:**
- `src/types/location.ts` - REGION_HIERARCHY에 추가
- `src/components/AddLocationModal.tsx` - districtMap에 매핑 추가

**자동화 단계:**
```
1. location.ts의 REGION_HIERARCHY에서 해당 Province에 District 추가
2. AddLocationModal.tsx의 districtMap에 주소→지역 매핑 추가
3. TypeScript 빌드 확인
```

---

### 3. 새 특징(Feature) 추가

**수행 파일:**
- `src/types/location.ts` - Features 인터페이스에 추가
- `src/schemas/llmSuggestions.ts` - FeatureSuggestionSchema에 추가
- `src/components/AddLocationModal.tsx` - featureOptions에 추가
- `src/components/LocationCard.tsx` - featureOptions에 추가

**자동화 단계:**
```
1. Features 인터페이스에 새 boolean 필드 추가 (snake_case)
2. FeatureSuggestionSchema에 z.boolean().optional() 추가
3. featureLabels에 한국어 라벨 추가
4. AddLocationModal.tsx의 featureOptions에 { key, label } 추가
5. LocationCard.tsx의 featureOptions에 { key, label } 추가
6. TypeScript 빌드 확인
```

---

### 4. DB 마이그레이션 스크립트 생성

**새 컬럼 추가:**
```sql
-- 새 컬럼 추가
ALTER TABLE locations ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;

-- 배열 컬럼 추가
ALTER TABLE locations ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- JSON 컬럼 추가
ALTER TABLE locations ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';
```

**인덱스 추가:**
```sql
-- 일반 인덱스
CREATE INDEX IF NOT EXISTS idx_locations_column ON locations(column_name);

-- 배열 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_locations_tags ON locations USING GIN(tags);
```

---

### 5. 빌드 및 검증

**빌드 명령어:**
```bash
# TypeScript 빌드 확인
npm run build

# 개발 서버 실행
npm run dev

# 린트 검사
npm run lint
```

**빌드 오류 해결 순서:**
1. TypeScript 타입 오류 확인
2. import 경로 확인
3. 누락된 props 확인
4. 빌드 재시도

---

### 6. Supabase 필드 추가 작업

**새 필드 추가 시 수정 파일:**
1. `src/types/location.ts` - Location 인터페이스에 필드 추가
2. `src/utils/supabase.ts` - getAll, create, update 함수에서 필드 처리
3. 관련 컴포넌트에서 필드 사용

**snake_case ↔ camelCase 변환 규칙:**
```typescript
// DB (snake_case) → 앱 (camelCase)
const imageUrl = item.image_url || item.imageUrl || '';
const eventTags = item.event_tags || item.eventTags || [];

// 앱 (camelCase) → DB (snake_case)
const supabaseData = {
  ...rest,
  image_url: imageUrl,
  event_tags: eventTags,
};
```

---

### 7. 이벤트 배너 추가

**수행 파일:**
- `src/App.tsx` - eventList 배열에 추가

**자동화 단계:**
```typescript
// App.tsx의 eventList에 추가
const eventList = [
  { name: '이벤트 표시명', tag: 'DB에 저장된 태그명' },
  // 새 이벤트 추가
];
```

**DB에 이벤트 태그 추가:**
```sql
UPDATE locations
SET event_tags = array_append(event_tags, '태그명')
WHERE id = 'location_id';
```

---

### 8. 환경 변수 추가

**필요한 환경 변수 (`.env`):**
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_KAKAO_RESTFUL_API_KEY=...
VITE_KAKAO_JS_KEY=...
VITE_NAVER_CLIENT_ID=...
VITE_NAVER_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
```

---

## 작업 자동화 체크리스트

### 새 기능 추가 시
- [ ] 타입 정의 추가/수정
- [ ] Supabase API 함수 수정
- [ ] 관련 컴포넌트 수정
- [ ] DB 마이그레이션 스크립트 작성
- [ ] TypeScript 빌드 확인
- [ ] 개발 서버에서 테스트

### 배포 전
- [ ] `npm run build` 성공
- [ ] 환경 변수 확인
- [ ] DB 마이그레이션 실행 여부 확인
- [ ] 변경사항 커밋

---

## 자주 사용하는 명령어

```bash
# 개발 서버
npm run dev

# 빌드
npm run build

# 빌드 미리보기
npm run preview

# Git 상태 확인
git status

# 변경사항 커밋
git add . && git commit -m "메시지"

# 푸시
git push origin main
```

---

## 파일 위치 빠른 참조

| 용도 | 파일 경로 |
|------|----------|
| 타입 정의 | `src/types/location.ts` |
| Supabase API | `src/utils/supabase.ts` |
| 메인 앱 | `src/App.tsx` |
| 장소 추가 모달 | `src/components/AddLocationModal.tsx` |
| 장소 카드 | `src/components/LocationCard.tsx` |
| LLM 스키마 | `src/schemas/llmSuggestions.ts` |
| API 라우트 | `api/suggest-tags.ts` |
