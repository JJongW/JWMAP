# JWMAP 서비스 상세 분석

> **오늘 오디가?** — 개인 큐레이션 맛집 맵 서비스의 기술·기능·데이터 구조 정리 문서

---

## 1. 서비스 개요

### 1.1 정체성

| 항목 | 내용 |
|------|------|
| **서비스명** | 오늘 오디가? (JWMAP) |
| **성격** | 서울·수도권 맛집 **큐레이션** 웹 서비스 |
| **원칙** | 개인이 직접 방문·검증한 장소만 수록 |
| **핵심 가치** | 빠른 의사결정 → 바로 출발 (발견보다 큐레이션 + 결정 속도) |
| **범위** | 서울 중심, 수도권·전국 확장 중 |

### 1.2 핵심 UX 플로우 (불변)

```
1. 사용자가 장소 탐색
   → 지역/카테고리 필터 또는 자연어 검색(LLM)

2. 장소 목록 표시
   → 필터/검색 결과에 따른 카드 리스트

3. 지도에서 선택한 장소 프리뷰
   → 마커 클릭 ↔ 리스트/프리뷰 동기화

4. 사용자 액션 (지도/길찾기)
   → PC: 웹 지도 페이지
   → 모바일: 네이버/카카오 앱 딥링크 (700ms 후 웹 fallback)
```

---

## 2. 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | React 18, TypeScript, Vite |
| **스타일** | Tailwind CSS |
| **DB** | Supabase (PostgreSQL) |
| **지도** | Kakao Maps API (SDK + 마커), Naver Maps(딥링크) |
| **LLM** | LangChain + Google Gemini (gemini-2.0-flash) |
| **이미지** | Cloudinary (업로드·최적화) |
| **배포** | Vercel (정적 + Serverless Functions) |
| **기타** | Axios, Zod, Vercel Speed Insights |

---

## 3. 프로젝트 구조

```
JWMAP/
├── project/
│   ├── src/
│   │   ├── App.tsx              # 진입점, 전역 상태·필터·CRUD·검색 orchestration
│   │   ├── main.tsx             # Kakao Maps SDK 동적 로드 후 앱 마운트
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── layout/          # 반응형 레이아웃
│   │   │   │   ├── MobileLayout.tsx
│   │   │   │   ├── DesktopLayout.tsx
│   │   │   │   ├── BottomSheet.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   ├── Map.tsx          # Kakao 지도 + 카테고리별 마커
│   │   │   ├── TopSearchBar.tsx # LLM 자연어 검색 UI
│   │   │   ├── FilterSection.tsx
│   │   │   ├── LocationList.tsx / LocationCard.tsx
│   │   │   ├── PlacePreview.tsx / PlaceDetail.tsx / SidebarDetail.tsx
│   │   │   ├── AddLocationModal.tsx / AddReviewModal.tsx
│   │   │   ├── PlaceSearch.tsx   # 카카오 장소 검색
│   │   │   ├── ImageUpload.tsx   # Cloudinary
│   │   │   ├── CommunityReviews.tsx
│   │   │   ├── ProofBar.tsx      # 큐레이터 인증 표시
│   │   │   ├── EventBanner.tsx / EventTagFilter.tsx
│   │   │   ├── CategoryButton.tsx / CustomSelect.tsx
│   │   │   ├── MobileOverlay.tsx
│   │   │   └── Footer.tsx
│   │   ├── hooks/
│   │   │   ├── useBreakpoint.ts  # 768px 기준 mobile/desktop
│   │   │   └── useBottomSheet.ts
│   │   ├── types/
│   │   │   ├── location.ts       # Province, Region, Category, Location, Review, Features
│   │   │   ├── ui.ts             # UiMode, BottomSheetState, SheetMode, BREAKPOINTS
│   │   │   └── kakao.d.ts
│   │   ├── schemas/
│   │   │   └── llmSuggestions.ts # LLM 태그 추천 Zod 스키마
│   │   ├── utils/
│   │   │   ├── supabase.ts       # locationApi, reviewApi, searchLogApi, clickLogApi
│   │   │   ├── apiClient.ts
│   │   │   ├── image.ts
│   │   │   └── kakaoShare.ts     # 카카오 공유
│   │   └── data/
│   │       └── locations.ts      # 레거시 정적 데이터(참고용)
│   ├── api/                      # Vercel Serverless
│   │   ├── search.ts             # LLM 자연어 → 구조화 쿼리 → DB 필터 → 검색 로그
│   │   └── suggest-tags.ts       # 장소 설명 기반 태그 추천
│   ├── public/                   # 마커 SVG, logo, robots.txt
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── CLAUDE.md
├── AGENTS.md
├── SERVICE_ANALYSIS.md           # 본 문서
└── README.md
```

---

## 4. 데이터 모델

### 4.1 지역·카테고리 계층

- **Province (시/도)**: 서울, 경기, 인천, 부산, 대구, 대전, 광주, 울산, 세종, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주 (17개)
- **Region (소분류)**: `REGION_HIERARCHY[Province]` 예: 서울 → 강남, 서초, 잠실/송파/강동, 홍대/합정/마포/연남, 용산/이태원/한남 등
- **CategoryMain**: 전체, 밥, 면, 국물, 고기요리, 해산물, 간편식, 양식·퓨전, 디저트, 카페, 술안주
- **CategorySub**: `CATEGORY_HIERARCHY[CategoryMain]` 예: 밥 → 덮밥, 정식, 도시락, 백반, 돈까스, 한식, 카레 / 면 → 라멘, 국수, 파스타 등 50+ 소분류

역추론: `inferProvinceFromRegion(region)`, `getMainFromSub(categorySub)` 로 상위 계층 보정.

### 4.2 Location (장소)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string (uuid) | PK |
| name | string | 장소명 |
| province | Province? | 시/도 (없으면 region으로 추론) |
| region | Region | 소분류 지역 (강남, 홍대 등) |
| sub_region | string? | 세부 지역 |
| category | string | 레거시 호환 |
| categoryMain | CategoryMain? | 대분류 |
| categorySub | CategorySub? | 소분류 |
| lon, lat | number | 경도, 위도 |
| address | string | 주소 |
| memo | string | 개인 메모 |
| short_desc | string? | 한 줄 설명(큐레이터 원라이너) |
| rating | number | 평점 |
| price_level | 1\|2\|3\|4? | 가격대 |
| imageUrl | string | 대표 이미지 URL |
| features | Features? | 혼밥/조용/웨이팅 짧음/데이트/단체/주차/반려동물/예약/심야 등 |
| tags | string[]? | LLM·수동 태그 |
| eventTags | string[]? | 이벤트 태그 (예: 흑백요리사 시즌2) |
| kakao_place_id, naver_place_id | string? | 딥링크용 |
| visit_date, created_at 등 | string? | 메타 |

### 4.3 Review (커뮤니티 리뷰)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | PK |
| location_id | string | FK |
| user_display_name | string? | 표시 이름 |
| one_liner | string | 한 줄 리뷰 |
| visit_type | 'first' \| 'revisit' | 첫방문/재방문 |
| features | Features? | 선택한 특징 |
| created_at | string | 작성 시각 |

### 4.4 Features (장소·리뷰 공통 특징)

- solo_ok, quiet, wait_short, date_ok, group_ok, parking, pet_friendly, reservation, late_night (모두 boolean 옵션)

### 4.5 Supabase 테이블 요약

- **locations**: 위 Location 필드와 1:1 대응 (snake_case 컬럼명, jsonb: features, event_tags 등)
- **reviews**: location_id FK, one_liner, visit_type, features(jsonb), created_at
- **search_logs**: query, parsed(jsonb), result_count, llm_ms, db_ms, total_ms, created_at
- **click_logs**: search_id?, location_id, action_type, created_at

---

## 5. 핵심 기능 상세

### 5.1 전역 상태 (App.tsx)

- **데이터**: locations (전체), searchResults, displayedLocations(검색 시 검색결과, 아니면 filteredLocations)
- **필터**: selectedProvince, selectedDistrict, selectedCategoryMain, selectedCategorySub, selectedEventTag
- **선택/프리뷰**: selectedLocation, previewLocation, detailLocation(모바일), hoveredLocationId(데스크탑)
- **모바일 UI**: uiMode(browse/explore), bottomSheetState(collapsed/half/full), sheetMode(list/preview)
- **검색**: isSearchMode, currentSearchId
- **페이징**: visibleLocations (10단위 증가)
- **모달**: isModalOpen (AddLocationModal)

필터는 캐스케이드: Province 변경 시 District/Category/Event 초기화, District 변경 시 Category 초기화, CategoryMain 변경 시 CategorySub 초기화.

### 5.2 필터링 로직

- **locationsForCategoryFilter**: Province + District + EventTag만 적용 (카테고리 제외) → 대분류/소분류 버튼 목록·카운트에 사용
- **filteredLocations**: Province + District + CategoryMain/CategorySub + EventTag 모두 적용
- **displayedLocations**: isSearchMode ? searchResults : filteredLocations
- 카테고리: location에 categoryMain이 없으면 categorySub로 getMainFromSub 역추론 후 매칭

### 5.3 LLM 자연어 검색

- **진입**: TopSearchBar에서 `POST /api/search` 호출, body: `{ text: "용산 혼밥 맛집" }`
- **api/search.ts**:
  1. Gemini로 자연어 → **LLMQuery** (region, categoryMain, categorySub, excludeCategoryMain, keywords, constraints, sort) 파싱
  2. Supabase locations에 대해 region/category/제외/constraints 필터
  3. tags·keywords 매칭 후 **태그 매치 우선, 그 다음 평점** 정렬
  4. search_logs에 query, parsed, result_count, llm_ms, db_ms, total_ms 저장
- **규칙**: LLM은 장소를 생성하지 않음. 모든 결과는 DB locations만 사용. 결과 없으면 places: [] + 메시지(예: "용산에는 아직 등록된 곳이 없어요").

### 5.4 지도 (Map.tsx)

- Kakao Maps SDK 동적 로드: main.tsx에서 VITE_KAKAO_APP_API_KEY로 스크립트 주입 후 앱 마운트
- 지도 초기화 후 locations 기준 마커 생성, categoryMain별 SVG 마커 매핑 (rice_marker, noodle_marker, cafe_marker 등)
- categoryMain 없으면 categorySub로 대분류 역추론 후 마커 이미지 선택
- 마커 클릭 → onMarkerClick → preview/리스트 연동, 선택 장소 시 지도 panTo

### 5.5 장소 CRUD

- **추가**: AddLocationModal → locationApi.create → snake_case 변환 후 insert, 응답을 camelCase로 매핑해 locations에 반영
- **수정/삭제**: LocationCard 등에서 locationApi.update/delete 호출, selectedLocation/previewLocation 동기 갱신
- **이미지**: ImageUpload + Cloudinary; PlaceSearch로 카카오 장소 검색 후 주소·좌표·kakao_place_id 등 보조 입력

### 5.6 리뷰

- AddReviewModal: one_liner, visit_type, features 입력 → reviewApi.create
- CommunityReviews: location_id 기준 리뷰 목록 표시 (최신순 등)

### 5.7 이벤트 태그

- availableEventTags: locations에서 eventTags 수집 (예: 흑백요리사 시즌2, 천하제빵 시즌1)
- EventBanner/EventTagFilter: 선택 시 selectedEventTag 반영 → filteredLocations에 eventTags 포함 여부로 필터

### 5.8 딥링크·공유

- PlacePreview/PlaceDetail 등: placeId 있으면 네이버/카카오 앱 딥링크, 없으면 좌표 기반 웹 지도
- 모바일: 딥링크 시도 후 700ms 뒤 웹 fallback; **딥링크는 사용자 클릭으로만** 호출 (자동 리다이렉트 금지)
- kakaoShare: 카카오 공유 등

### 5.9 URL 쿼리

- `?locationId=uuid` 있으면 해당 장소 선택 후 모바일이면 detailLocation 설정, PC면 SidebarDetail 표시. 처리 후 쿼리 제거(history.replaceState).

---

## 6. 반응형 레이아웃

- **useBreakpoint()**: 768px 미만 = mobile, 이상 = desktop
- **모바일**: MobileLayout + BottomSheet (list/preview), UiMode(browse/explore), BottomSheetState(collapsed/half/full)
- **데스크탑**: DesktopLayout + Sidebar, SidebarDetail(선택 장소 상세), 지도와 리스트 분할

---

## 7. API 요약

| 엔드포인트 | 역할 |
|------------|------|
| **POST /api/search** | 자연어 → LLMQuery 파싱 → locations 필터·정렬 → places 반환 + search_logs 기록 |
| **POST /api/suggest-tags** | 장소 설명 등 입력 → LLM 태그 추천 (Zod 스키마) |

클라이언트는 Supabase anon key로 locations/reviews 직접 조회·변경; 검색·태그 추천만 Vercel Functions 경유.

---

## 8. 환경 변수

- **프론트 (VITE_ prefix, project/.env)**  
  VITE_KAKAO_APP_API_KEY, VITE_KAKAO_RESTFUL_API_KEY, VITE_NAVER_CLIENT_ID, VITE_NAVER_CLIENT_SECRET,  
  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET
- **백엔드 (Vercel)**  
  SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_API_KEY

Kakao Maps는 **JavaScript 키** 사용, 도메인(예: localhost:5173, localhost:5174, 운영 도메인) Kakao Developers에 등록 필요.

---

## 9. 로깅·분석

- **search_logs**: 쿼리, 파싱 결과(parsed), result_count, llm_ms, db_ms, total_ms
- **click_logs**: search_id(선택), location_id, action_type
- Vercel Speed Insights 사용

---

## 10. 확장·유지보수 포인트

- **새 카테고리**: location.ts 타입·CATEGORY_HIERARCHY, api/search.ts SYSTEM_PROMPT, 마커 매핑(필요 시)
- **새 지역**: Province·REGION_HIERARCHY, search SYSTEM_PROMPT
- **새 Features**: location.ts Features, AddLocationModal/LocationCard 옵션, search constraints
- **DB 컬럼 추가**: Supabase 컬럼 추가 후 location.ts, supabase.ts 매핑 (snake_case ↔ camelCase 유지)

---

## 11. 정리

JWMAP은 **큐레이션 맛집 맵**으로, 필터·자연어 검색(LLM)·지도·리스트·상세·딥링크가 한 플로우로 연결되어 있다.  
모든 검색 결과는 DB locations에만 의존하며, LLM은 쿼리 해석과 태그 추천에만 쓰인다.  
상태는 App.tsx에서 중앙 관리하고, 반응형은 768px 기준 모바일(바텀시트)/데스크탑(사이드바)로 구분된다.
