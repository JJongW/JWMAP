# 오늘 오디가?

서울 지역의 개인적으로 방문하고 검증한 맛집 정보를 지도에서 확인할 수 있는 웹 서비스입니다.

## 서비스 소개

이 서비스는 개인적으로 방문하고 검증한 서울 지역의 맛집만을 수록합니다. 빠른 의사결정을 돕기 위한 큐레이션과 속도에 중점을 둔 서비스입니다.

## 주요 기능

### 검색 및 필터링
- 지역별 필터링 (서울 19개 구/지역)
- 카테고리별 필터링 (한식, 일식, 라멘, 카페, 카공카페 등)
- 자연어 검색 (LLM 기반 검색)
- 이벤트 배너 필터링 (예: 흑백요리사 시즌2 식당, 천하제빵(곧 추가!))

### 지도 연동
- 카카오 지도 연동으로 위치 확인
- 카테고리별 커스텀 마커 (라멘, 카공카페, 카페)
- 카카오맵 앱 딥링크 연결 (placeId 우선 사용)
- 네이버 지도 앱 딥링크 연결 (placeId 우선 사용)
- 앱 미설치 시 웹으로 자동 fallback

### 장소 관리
- 장소 추가/수정/삭제 기능
- 이미지 업로드 (Cloudinary 연동)
- 평점 및 메모 관리
- 장소 특징 태그 (혼밥 가능, 조용한 분위기, 웨이팅 짧음 등)

### UI/UX
- 반응형 디자인 (모바일/데스크톱 지원)
- Paperozi 폰트 적용
- 직관적인 필터링 인터페이스
- 실시간 검색 결과 업데이트

## 기술 스택

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React (아이콘)
- Paperozi 폰트

### Backend & Database
- Supabase (PostgreSQL)
- Vercel Serverless Functions

### APIs & Services
- Kakao Maps API
- Kakao Local Search API
- Naver Local Search API
- Google Gemini API (LLM 검색)
- Cloudinary (이미지 업로드)


## 프로젝트 구조

```
JWMAP/
├── project/
│   ├── src/
│   │   ├── App.tsx                    # 메인 앱 컴포넌트
│   │   ├── components/
│   │   │   ├── AddLocationModal.tsx   # 장소 추가 모달
│   │   │   ├── CategoryButton.tsx     # 카테고리 버튼
│   │   │   ├── CustomSelect.tsx       # 커스텀 셀렉트
│   │   │   ├── EventBanner.tsx        # 이벤트 배너
│   │   │   ├── Footer.tsx             # 푸터
│   │   │   ├── ImageUpload.tsx        # 이미지 업로드
│   │   │   ├── LocationCard.tsx      # 장소 카드
│   │   │   ├── Map.tsx                # 카카오 지도
│   │   │   ├── PlaceSearch.tsx       # 장소 검색
│   │   │   └── TopSearchBar.tsx      # LLM 검색 바
│   │   ├── types/
│   │   │   ├── kakao.d.ts            # 카카오맵 타입
│   │   │   └── location.ts           # Location 타입
│   │   ├── schemas/
│   │   │   └── llmSuggestions.ts     # LLM 제안 스키마
│   │   └── utils/
│   │       ├── apiClient.ts          # API 클라이언트
│   │       └── supabase.ts           # Supabase 클라이언트
│   ├── api/
│   │   ├── search.ts                 # LLM 검색 API
│   │   └── suggest-tags.ts           # 태그 제안 API
│   ├── public/
│   │   ├── logo.svg                  # 서비스 로고
│   │   ├── ramen-marker.svg          # 라멘 마커
│   │   ├── cafe-marker.svg           # 카페 마커
│   │   ├── note-marker.svg           # 카공카페 마커
│   │   └── sitemap.xml               # 사이트맵
│   └── package.json
└── README.md
```

## 주요 기능 상세

### 자연어 검색
LLM(Gemini)을 활용한 자연어 검색 기능으로 "혼밥하기 좋은 강남 맛집"과 같은 자연스러운 검색이 가능합니다.

### 이벤트 배너
특정 이벤트(예: 흑백요리사 시즌2)에 포함된 식당들을 한 번에 필터링할 수 있습니다.

### 앱 딥링크
모바일 환경에서 카카오맵 또는 네이버 지도 앱으로 직접 연결됩니다. 앱이 설치되어 있지 않으면 웹 버전으로 자동 연결됩니다.

### 커스텀 마커
카테고리별로 다른 마커 아이콘을 사용합니다:
- 라멘: 면 그릇 마커
- 카공카페: 노트 마커
- 카페: 카페 마커
- 기타: 기본 마커

## 배포

Vercel을 통해 배포됩니다.

```bash
cd project
npm run build
```

Vercel 환경 변수에도 동일한 값을 설정해주세요.

## 라이선스

ISC
