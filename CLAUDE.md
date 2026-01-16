# JWMAP - 오늘 오디가?

서울 맛집 큐레이션 웹 서비스. 개인적으로 방문하고 검증한 장소만 수록.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Maps:** Kakao Maps API + Naver Maps (deeplinks)
- **LLM:** LangChain + Google Gemini (gemini-2.0-flash)
- **Images:** Cloudinary
- **Deployment:** Vercel

## Project Structure

```
JWMAP/
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
| Column | Type |
|--------|------|
| id | uuid |
| query | text |
| parsed | jsonb |
| result_count | int |
| llm_ms, db_ms, total_ms | int |
| created_at | timestamptz |

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
{ "text": "용산 혼밥 맛집" }

// Response
{
  "places": [Location, ...],
  "query": {
    "region": ["용산/이태원/한남"],
    "categoryMain": [],
    "excludeCategoryMain": ["카페"],
    "keywords": ["혼밥", "맛집"],
    "constraints": { "solo_ok": true },
    "sort": "relevance"
  },
  "traceId": "uuid",
  "timing": { "llmMs": 245, "dbMs": 32, "totalMs": 285 }
}
```

**파이프라인:**
1. LLM이 자연어 → `LLMQuery` 파싱 (Gemini Flash)
2. region, categoryMain/Sub 필터링
3. excludeCategoryMain으로 카테고리 제외
4. features/constraints 필터링
5. tags/keywords 매칭 및 부스팅
6. 결과 정렬 (태그 매치 > 평점)
7. search_logs에 로깅

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
