# 🟢 SESSION START PROTOCOL (새 대화 시작 시 반드시 실행)

새 대화가 시작되면 **코드를 작성하기 전** 아래 3개 파일을 읽고 사용자에게 현재 상태를 브리핑한다:

```
1. Read: .claude/context/CURRENT_PLAN.md   → 현재 작업 목표 파악
2. Read: .claude/context/CONTEXT_LOG.md    → 지난 결정 맥락 파악
3. Read: .claude/context/TODO_CHECKLIST.md → 남은 작업 확인
```

브리핑 형식:
```
📋 이전 계획: {CURRENT_PLAN.md의 목표}
✅ 완료: {TODO_CHECKLIST의 완료 항목 수}개
📌 남은 작업: {남은 항목 목록}
```
파일이 비어있거나 없으면: **"새 세션 시작. /plan으로 계획 수립 필요."**

---

# ⚡ AUTOMATED PIPELINE (모든 작업에 자동 적용)

**명령을 받으면 아래 5단계를 묻지 않고 자동으로 실행한다. 단계를 건너뛰거나 허락을 구하지 않는다.**

### STEP 1 — READ FIRST
```
1. Read: /Users/sjw/.claude/projects/-Users-sjw-ted-urssu-jmw-auto-engine/memory/MEMORY.md
2. 관련 파일 탐색 → 기존 패턴 재사용 확인
```

### STEP 2 — PLAN (파일 수정 전 TodoWrite 생성)
```
모든 서브태스크를 TodoWrite로 목록화 → in_progress → completed 즉시 업데이트
```

### STEP 3 — EXECUTE + AUTO SELF-CHECK

| 수정 파일 | 자동 점검 |
|---|---|
| `admin/src/app/*/page.tsx` | AdminLayout 래핑? 서버 컴포넌트? |
| `admin/src/app/*/actions.ts` | 'use server' 디렉티브? revalidatePath? |
| `admin/src/app/*.tsx` ('use client') | useTransition으로 서버 액션 호출? |
| `admin/src/lib/queries/*.ts` | createServerSupabase()? non-fatal 오류? |
| `admin/src/components/layout/Sidebar.tsx` | lucide-react import? navItems 배열? |
| `odiga-api/lib/intent.ts` | SYSTEM_PROMPT 예시 케이스 포함? |
| `odiga-api/api/recommend.ts` | parseErrors 오버라이드 후 필터링? |

**스키마 제약**:
- `locations` → `province` O / `attractions` → `province` X
- `place_candidates` status: `pending | approved | rejected | consumed`
- `generated_drafts` status: `draft | approved | published | rejected`
- `daily_checklist` unique: `(task_type, date)`

**Admin 디자인 시스템**:
- Accent: `sky-500` (콘텐츠 엔진/todo) / `orange-500` (odiga 대시보드)
- 카드: `shadow-sm rounded-xl border-gray-100 bg-white`
- Recharts 컴포넌트는 'use client' 필수

### STEP 4 — QUALITY (수정 완료 후 자동 실행)
```bash
cd /Users/sjw/ted.urssu/JWMAP/admin && npm run build
```
실패 시 → 즉시 원인 파악 후 자동 수정 → 재실행

### STEP 5 — SHIP (작업 완료 후 자동 실행)
```bash
gh issue create → git checkout -b → git add → git commit → gh pr create → gh pr merge --delete-branch
```
- 이슈 번호를 커밋/PR body에 포함 (`#N`)
- `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` 커밋 푸터 필수
- JWMAP 레포: `cd /Users/sjw/ted.urssu/JWMAP/admin` 기준으로 작업

---

# JWMAP - 오늘 오디가?

서울 맛집 큐레이션 웹 서비스. 개인적으로 방문하고 검증한 장소만 수록.

## Tech Stack

- **Frontend (project/):** React 18 + TypeScript + Vite
- **Admin (admin/):** Next.js 16 App Router + TypeScript
- **CLI (odiga/):** Node.js ESM + TypeScript (npm publish)
- **API (odiga-api/):** Vercel Serverless Functions (TypeScript)
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Maps:** Kakao Maps API + Naver Maps (deeplinks)
- **LLM:** LangChain + Google Gemini (gemini-2.0-flash)
- **Images:** Cloudinary
- **Deployment:** Vercel

## Project Structure

```
JWMAP/
├── odiga/                          # CLI npm 패키지 (npm install -g odiga)
│   ├── src/
│   │   ├── index.ts              # CLI 진입점
│   │   ├── api/client.ts         # API 클라이언트 (odiga.vercel.app/api)
│   │   ├── api/types.ts          # BrandedCourse, curation_text 등
│   │   ├── ui/renderer.ts        # curation_text 기반 코스 렌더링
│   │   ├── ui/colors.ts          # Apricot Orange (#FF8A3D) 브랜드 색상
│   │   └── utils/mapLink.ts      # 네이버/카카오 딥링크
│   └── package.json              # version 1.3.0
├── odiga-api/                      # Vercel Serverless API (odiga.vercel.app)
│   ├── api/
│   │   ├── recommend.ts          # 메인 추천 파이프라인
│   │   ├── log.ts                # 검색 로그 기록
│   │   ├── stats.ts              # 통계 조회
│   │   └── save-course.ts        # 코스 저장
│   └── lib/
│       ├── curation.ts           # LLM 큐레이션 (장소: JSON, 코스: 텍스트)
│       ├── scoring.ts            # 스코어링 엔진
│       └── intentParser.ts       # 자연어 → ParsedIntent
├── admin/                          # 콘텐츠 관리 대시보드 (Next.js 16)
│   ├── app/                      # App Router
│   ├── supabase/migrations/      # DB 마이그레이션 SQL
│   └── tests/                    # Vitest + Playwright
├── project/
│   ├── src/
│   │   ├── App.tsx                 # 메인 앱, 전역 상태 관리
│   │   ├── components/
│   │   │   ├── layout/             # 레이아웃 컴포넌트
│   │   │   │   ├── MobileLayout.tsx
│   │   │   │   ├── DesktopLayout.tsx
│   │   │   │   ├── BottomSheet.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   ├── Map.tsx             # Kakao Maps 통합
│   │   │   ├── LocationCard.tsx    # 장소 카드 (수정/삭제)
│   │   │   ├── LocationList.tsx    # 장소 목록
│   │   │   ├── PlaceDetail.tsx     # 장소 상세 모달
│   │   │   ├── PlacePreview.tsx    # 장소 미리보기
│   │   │   ├── AddLocationModal.tsx # 장소 추가 모달
│   │   │   ├── AddReviewModal.tsx  # 리뷰 추가 모달
│   │   │   ├── TopSearchBar.tsx    # LLM 자연어 검색
│   │   │   ├── FilterSection.tsx   # 필터 UI
│   │   │   ├── PlaceSearch.tsx     # 카카오 장소 검색
│   │   │   ├── ImageUpload.tsx     # Cloudinary 이미지 업로드
│   │   │   ├── CommunityReviews.tsx # 커뮤니티 리뷰
│   │   │   ├── ProofBar.tsx        # 큐레이터 인증 바
│   │   │   ├── EventBanner.tsx     # 이벤트 배너
│   │   │   ├── CategoryButton.tsx
│   │   │   ├── CustomSelect.tsx
│   │   │   └── Footer.tsx
│   │   ├── hooks/
│   │   │   ├── useBreakpoint.ts    # 반응형 브레이크포인트
│   │   │   └── useBottomSheet.ts   # 바텀시트 제스처
│   │   ├── types/
│   │   │   ├── location.ts         # Location, Region, Category 타입
│   │   │   ├── ui.ts               # UI 상태 타입
│   │   │   └── kakao.d.ts          # Kakao Maps 타입 선언
│   │   ├── schemas/
│   │   │   └── llmSuggestions.ts   # LLM 응답 Zod 스키마
│   │   ├── utils/
│   │   │   ├── supabase.ts         # Supabase 클라이언트 & CRUD
│   │   │   ├── apiClient.ts        # Axios 설정
│   │   │   └── image.ts            # 이미지 유틸리티
│   │   └── data/
│   │       └── locations.ts        # 정적 데이터 (레거시)
│   ├── api/                        # Vercel Serverless Functions
│   │   ├── search.ts               # LLM 자연어 검색 API
│   │   └── suggest-tags.ts         # 태그 추천 API
│   ├── public/
│   │   ├── *_marker.svg            # 카테고리별 마커 아이콘
│   │   ├── logo.svg
│   │   └── robots.txt
│   └── package.json
├── CLAUDE.md                       # 이 파일
├── AGENTS.md                       # AI 에이전트 규칙
└── README.md                       # 프로젝트 소개
```

## Commands

```bash
cd project
npm run dev      # 개발 서버 (localhost:5173)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 검사
npm run preview  # 빌드 미리보기
```

## Environment Variables

`project/.env`:
```bash
# Frontend (VITE_ prefix)
VITE_OWNER_MODE=               # 'true'일 때만 쩝쩝박사 라벨 수정 가능 (주인장 전용)
VITE_KAKAO_APP_API_KEY=        # Kakao Maps SDK
VITE_KAKAO_RESTFUL_API_KEY=    # Kakao Places API
VITE_NAVER_CLIENT_ID=          # Naver API
VITE_NAVER_CLIENT_SECRET=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=

# Backend (Vercel - 대시보드에서 설정)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=          # Service role key
GOOGLE_API_KEY=                # Gemini API
```

## Key Types

```typescript
// 지역 계층
type Province = '서울' | '경기' | '인천' | '부산' | ... // 17개 시/도
type Region = string;  // 소분류 (강남, 홍대 등)

// 카테고리 계층
type CategoryMain = '전체' | '밥' | '면' | '국물' | '고기요리' | '해산물'
                  | '간편식' | '양식·퓨전' | '디저트' | '카페' | '술안주';
type CategorySub = '라멘' | '덮밥' | '회' | '이자카야' | ... // 50+ 소분류

// 장소 특징
interface Features {
  solo_ok?: boolean;      // 혼밥 가능
  quiet?: boolean;        // 조용한 분위기
  wait_short?: boolean;   // 웨이팅 짧음
  date_ok?: boolean;      // 데이트 추천
  group_ok?: boolean;     // 단체석 있음
  parking?: boolean;      // 주차 가능
  pet_friendly?: boolean; // 반려동물 동반
  reservation?: boolean;  // 예약 가능
  late_night?: boolean;   // 심야 영업
}

// 장소
interface Location {
  id: string;
  name: string;
  province?: Province;
  region: Region;
  sub_region?: string;
  categoryMain?: CategoryMain;
  categorySub?: CategorySub;
  category: string;           // 레거시 호환
  lon: number;
  lat: number;
  address: string;
  memo: string;               // 개인 메모 (장문)
  short_desc?: string;        // 한줄 설명
  rating: number;
  price_level?: 1|2|3|4;
  features?: Features;
  tags?: string[];            // LLM 태그
  imageUrl: string;
  eventTags?: string[];
  kakao_place_id?: string;
  naver_place_id?: string;
  visit_date?: string;
  created_at?: string;
}

// 리뷰
interface Review {
  id: string;
  location_id: string;
  user_display_name?: string;
  one_liner: string;
  visit_type: 'first' | 'revisit';
  features?: Features;
  created_at: string;
}

// 검색 Intent (api/search.ts)
type SearchIntent =
  | 'DISCOVER_RECOMMEND' | 'SEARCH_BY_FOOD' | 'SEARCH_BY_CATEGORY'
  | 'SEARCH_BY_REGION' | 'SEARCH_BY_CONSTRAINTS' | 'SEARCH_BY_CONTEXT'
  | 'COMPARE_OPTIONS' | 'RANDOM_PICK' | 'FIND_NEAR_ME' | 'FIND_OPEN_NOW'
  | 'FIND_LATE_NIGHT' | 'FIND_BEST_FOR' | 'ASK_DETAILS' | 'ASK_SIMILAR_TO'
  | 'ASK_EXCLUDE' | 'CLARIFY_QUERY';

// 검색 Slots (api/search.ts)
interface SearchSlots {
  region: string | null;
  sub_region: string | null;
  place_name: string | null;
  category_main: string | null;
  category_sub: string | null;
  exclude_category_main: string[] | null;
  time_of_day: '아침' | '점심' | '저녁' | '야식' | '심야' | '브런치' | null;
  visit_context: '혼밥' | '혼술' | '데이트' | '접대' | '가족모임' | ... | null;
  constraints: SearchConstraint[];
  keywords: string[];
  count: number | null;
  open_now: boolean | null;
}
```

## Database (Supabase)

### Table: `locations`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| name | text | 장소명 |
| region | text | 지역 소분류 (강남, 홍대 등) |
| sub_region | text? | 세부 지역 (한남동) |
| category | text | 레거시 카테고리 |
| category_main | text? | 카테고리 대분류 |
| category_sub | text? | 카테고리 소분류 |
| lon, lat | double | 좌표 |
| address | text | 주소 |
| memo | text | 개인 메모 |
| short_desc | text? | 한줄 설명 |
| features | jsonb | 장소 특징 |
| tags | text[] | LLM 태그 |
| rating | double | 평점 |
| price_level | smallint? | 가격대 1-4 |
| naver_place_id | text? | 네이버 딥링크용 |
| kakao_place_id | text? | 카카오 딥링크용 |
| imageUrl | text | 이미지 URL |
| event_tags | jsonb | 이벤트 태그 |
| visit_date | date? | 방문일 |
| created_at | timestamptz | 생성일 |

### Table: `attractions`
볼거리/관광지 장소 (코스 추천 시 `locations`와 혼합 사용)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| name | text | 장소명 |
| region | text | 지역 소분류 |
| sub_region | text? | 세부 지역 |
| category_main | text? | 카테고리 대분류 |
| category_sub | text? | 카테고리 소분류 |
| lon, lat | double | 좌표 |
| address | text | 주소 |
| memo | text? | 메모 |
| short_desc | text? | 한줄 설명 |
| features | jsonb | 장소 특징 |
| tags | text[] | LLM 태그 |
| rating | double | 평점 |
| naver_place_id | text? | 네이버 딥링크용 |
| kakao_place_id | text? | 카카오 딥링크용 |

> `locations`와 달리 `province` 컬럼 없음, `imageUrl`/`price_level` 없음

### Table: `reviews`
| Column | Type |
|--------|------|
| id | uuid |
| location_id | uuid FK |
| user_display_name | text |
| one_liner | text |
| visit_type | text |
| features | jsonb |
| created_at | timestamptz |

### Table: `search_logs`
프론트엔드 자연어 검색 로그 (project/ api/search.ts)

| Column | Type |
|--------|------|
| id | uuid |
| query | text |
| parsed | jsonb |
| result_count | int |
| llm_ms, db_ms, total_ms | int |
| created_at | timestamptz |

### Table: `odiga_search_logs`
CLI odiga 검색 로그 (odiga-api/ api/log.ts)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| raw_query | text | 원본 검색 쿼리 |
| region | text? | 지역 |
| vibe | text[] | 분위기 키워드 |
| people_count | int? | 인원수 |
| mode | text? | 이동수단 |
| season | text? | 계절 |
| activity_type | text? | 활동 유형 |
| response_type | text? | 'single' \| 'course' |
| selected_course | jsonb? | 선택된 코스 |
| selected_place_id | text? | 선택된 장소 ID |
| selected_place_name | text? | 선택된 장소명 |
| regenerate_count | int | 재추천 횟수 |
| parse_error_fields | text[] | 파싱 오류 필드 |
| user_feedbacks | text[] | 사용자 피드백 목록 |
| created_at | timestamptz | 생성일 |

### Table: `click_logs`
| Column | Type |
|--------|------|
| id | uuid |
| search_id | uuid? |
| location_id | uuid |
| action_type | text |
| created_at | timestamptz |

## LLM Search API

### POST /api/search

```json
// Request
{
  "text": "용산 혼밥 맛집",
  "uiRegion": "용산/이태원/한남"  // optional, UI에서 선택된 지역
}

// Response (Enhanced)
{
  "places": [Location, ...],

  // Intent & Slots (새 구조)
  "intent": "SEARCH_BY_CONSTRAINTS",
  "slots": {
    "region": "용산/이태원/한남",
    "sub_region": null,
    "place_name": null,
    "category_main": null,
    "category_sub": null,
    "exclude_category_main": ["카페"],
    "time_of_day": null,
    "visit_context": "혼밥",
    "constraints": [],
    "keywords": ["맛집"],
    "count": null,
    "open_now": null
  },

  // Legacy query (하위 호환)
  "query": {
    "region": ["용산/이태원/한남"],
    "excludeCategoryMain": ["카페"],
    "keywords": ["혼밥", "맛집"],
    "constraints": { "solo_ok": true }
  },

  // Actions for frontend
  "actions": {
    "mode": "browse",
    "should_show_map": true,
    "result_limit": 50,
    "fallback_applied": false,
    "fallback_notes": [],
    "fallback_level": 0
  },

  // UI hints
  "ui_hints": {
    "message_type": "success",
    "message": "15개의 장소를 찾았어요!"
  },

  "traceId": "uuid",
  "timing": { "llmMs": 245, "dbMs": 32, "totalMs": 285 }
}
```

### Search Intent Types (16가지)

| Intent | 설명 | 예시 |
|--------|------|------|
| DISCOVER_RECOMMEND | 추천 요청 | "맛집 추천해줘" |
| SEARCH_BY_FOOD | 특정 음식 검색 | "라멘 먹고 싶어" |
| SEARCH_BY_CATEGORY | 카테고리 검색 | "밥집", "면집" |
| SEARCH_BY_REGION | 지역 검색 | "강남 맛집" |
| SEARCH_BY_CONSTRAINTS | 조건 검색 | "혼밥 가능한 곳" |
| SEARCH_BY_CONTEXT | 상황 검색 | "데이트 장소" |
| COMPARE_OPTIONS | 비교 | "A vs B" |
| RANDOM_PICK | 랜덤 | "아무거나" |
| FIND_NEAR_ME | 근처 검색 | "근처 맛집" |
| FIND_OPEN_NOW | 영업중 검색 | "지금 열린 곳" |
| FIND_LATE_NIGHT | 야식 검색 | "야식 맛집" |
| FIND_BEST_FOR | 용도 검색 | "~하기 좋은 곳" |
| ASK_DETAILS | 장소 질문 | "히코 어때?" |
| ASK_SIMILAR_TO | 유사 검색 | "~랑 비슷한 곳" |
| ASK_EXCLUDE | 제외 검색 | "카페 빼고" |
| CLARIFY_QUERY | 불명확 | 파싱 실패 시 |

### Visit Context Types

| Context | 설명 |
|---------|------|
| 혼밥 | 혼자 식사 (카페 자동 제외) |
| 혼술 | 혼자 음주 |
| 데이트 | 연인과 식사 |
| 접대 | 비즈니스 식사 |
| 가족모임 | 가족 식사 |
| 친구모임 | 친구들과 식사 |
| 회식 | 회사 모임 |
| 소개팅 | 첫 만남 |
| 생일/기념일 | 특별한 날 |
| 카공 | 카페에서 공부 |
| 반려동물_동반 | 펫 프렌들리 |

### Search Constraints

| Constraint | 설명 |
|------------|------|
| 웨이팅_없음 | 바로 입장 |
| 예약_가능 | 예약 가능 |
| 주차_가능 | 주차 가능 |
| 좌석_넉넉 | 넓은 좌석 |
| 오래_앉기 | 장시간 가능 |
| 조용한 | 조용한 분위기 |
| 빠른_회전 | 빠른 식사 |
| 가성비 | 가격 대비 좋음 |
| 비싼_곳_제외 | 저렴한 곳만 |
| 체인점_제외 | 로컬 맛집만 |

### 5-Level Fallback Strategy

검색 결과가 없을 때 자동으로 조건을 완화:

| Level | Action | 예시 |
|-------|--------|------|
| 0 | 원본 쿼리 | - |
| 1 | 비핵심 조건 제거 | 체인점_제외, 가성비 제거 |
| 2 | 웨이팅 조건 제거 | 웨이팅_없음 제거 |
| 3 | 카테고리 확장 | 라멘 → 면 전체 |
| 4 | 지역 확장 | 한남동 → 용산 → 서울 전체 |
| 5 | 인기 장소 | 조건 무시, 평점순 추천 |

**파이프라인:**
1. LLM이 자연어 → Intent + Slots 파싱 (Gemini Flash)
2. Slots를 Legacy Query로 변환 (하위 호환)
3. region, categoryMain/Sub 필터링
4. excludeCategoryMain으로 카테고리 제외
5. visit_context/constraints 필터링
6. tags/keywords 매칭 및 부스팅
7. 결과 없으면 5-Level Fallback 적용
8. UI hints 및 actions 생성
9. search_logs에 로깅

## Map Markers

카테고리 대분류별 마커 아이콘 (`/public/`):
| CategoryMain | Marker File |
|--------------|-------------|
| 밥 | rice_marker.svg |
| 면 | nooddle_marker.svg |
| 국물 | bowl_marker.svg |
| 고기요리 | beef_marker.svg |
| 해산물 | fish_marker.svg |
| 간편식 | fast_marker.svg |
| 양식·퓨전 | sushi_marker.svg |
| 디저트 | desert_marker.svg |
| 카페 | cafe_marker.svg |
| 술안주 | beer_marker.svg |

## Important Patterns

### 1. State Management
- 전역 상태: `App.tsx`에서 React hooks로 관리
- 필터 상태: province → district → categoryMain → categorySub 캐스케이드
- 검색 모드: `isSearchMode`로 필터/검색 결과 전환

### 2. Responsive Layout
- `useBreakpoint()` 훅으로 mobile/desktop 감지
- Mobile: BottomSheet + MobileLayout
- Desktop: Sidebar + DesktopLayout
- Breakpoint: 768px

### 3. Deeplinks
- 모바일: Kakao/Naver 앱 딥링크 시도
- 700ms timeout 후 웹 fallback
- placeId 우선, 없으면 좌표 기반

### 4. snake_case ↔ camelCase
```typescript
// DB → App
const imageUrl = item.image_url || item.imageUrl;
const categoryMain = item.category_main || item.categoryMain;

// App → DB
const supabaseData = {
  image_url: imageUrl,
  category_main: categoryMain,
};
```

## Common Tasks

### 새 카테고리 추가
1. `src/types/location.ts` - CategoryMain/CategorySub 타입 추가
2. `src/types/location.ts` - CATEGORY_HIERARCHY에 매핑 추가
3. `api/search.ts` - SYSTEM_PROMPT에 카테고리 설명 추가
4. `public/` - 마커 SVG 추가 (필요시)
5. `src/components/Map.tsx` - 마커 매핑 추가

### 새 지역 추가
1. `src/types/location.ts` - Province 타입 추가
2. `src/types/location.ts` - REGION_HIERARCHY에 지역 목록 추가
3. `api/search.ts` - SYSTEM_PROMPT에 지역 추가

### 새 Feature 추가
1. `src/types/location.ts` - Features 인터페이스에 필드 추가
2. `src/components/AddLocationModal.tsx` - featureOptions에 추가
3. `src/components/LocationCard.tsx` - featureOptions에 추가
4. `api/search.ts` - constraints에 추가 (필요시)

### Supabase 필드 추가
1. Supabase 대시보드에서 컬럼 추가
2. `src/types/location.ts` - Location 인터페이스 수정
3. `src/utils/supabase.ts` - getAll/create/update에서 필드 매핑

## Admin UI Design System

`admin/` 대시보드는 **Catalyst SaaS 스타일**을 사용한다. 모든 admin 페이지/컴포넌트에 아래 규칙을 적용한다.

### 브랜드 컬러
- Primary accent: `#FF8A3D` (Apricot Orange) — CLI `odiga/src/ui/colors.ts`와 동일
- Tailwind: `orange-500` / `orange-600` (인터랙티브), `orange-50` / `orange-100` (배경)

### 카드 패턴
```tsx
<Card className="shadow-sm rounded-xl border-gray-100 bg-white">
  <div className="px-5 pt-5 pb-3">
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">섹션 제목</p>
    <p className="text-xs text-muted-foreground/70 mt-0.5">서브 설명 또는 카운트</p>
  </div>
  <CardContent className="px-5 pb-5">
    {/* content */}
  </CardContent>
</Card>
```
- `CardHeader`/`CardTitle` 사용 금지 — raw `div`로 직접 패딩 제어
- 모든 카드: `shadow-sm rounded-xl border-gray-100 bg-white`

### 섹션 레이블
컨텐츠/메트릭 위에 항상 소문자 레이블 배치:
```tsx
<p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">레이블</p>
```

### 버튼
- Primary (저장, 제출): `bg-orange-500 hover:bg-orange-600 text-white`
- Secondary: `variant="outline"` + `border-gray-200 hover:border-orange-300 hover:text-orange-600`
- Destructive/subtle: `variant="ghost"` + `hover:text-red-500 hover:bg-red-50`

### 배지 / 필
```tsx
// 오렌지 (카운트, 강조)
<span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">N곳</span>

// 상태 배지
// healthy:  bg-emerald-50 text-emerald-700
// warning:  bg-orange-50  text-orange-600
// error:    bg-red-50     text-red-600
// unknown:  bg-gray-100   text-muted-foreground
```

### 리스트 아이템
```tsx
<div className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50/50 transition-colors">
  {/* item content */}
</div>
```

### 페이지 제목
```tsx
<h1 className="text-xl font-bold tracking-tight">페이지 제목</h1>
<p className="text-xs text-muted-foreground mt-1">설명</p>
```

### 차트 (Recharts)
- Primary stroke: `#FF8A3D`
- Area fill gradient: `#FF8A3D` 15% → 0% opacity
- Bar colors: `#FF8A3D` / `#FFBB85` / `#E5E7EB` (primary / secondary / empty)
- Recharts 컴포넌트는 반드시 `'use client'`

### 기간 필터 탭
```tsx
<div className="flex items-center rounded-lg border bg-gray-50 p-0.5 gap-0.5">
  <button className={cn(
    'h-7 rounded-md px-3 text-xs font-medium transition-all',
    active ? 'bg-orange-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
  )}>레이블</button>
</div>
```
