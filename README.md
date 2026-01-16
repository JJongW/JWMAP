# 오늘 오디가?

> 직접 가본 맛집만 수록하는 큐레이션 맛집 지도

서울/수도권 맛집을 빠르게 결정하고 바로 출발할 수 있도록 돕는 웹 서비스입니다.

## 특징

- **검증된 장소만**: 운영자가 직접 방문하고 검증한 곳만 수록
- **자연어 검색**: "용산 혼밥 맛집" 같은 자연스러운 검색 지원
- **빠른 결정**: 한눈에 파악하는 카테고리와 필터
- **지도 앱 연동**: 탭 한 번으로 네이버/카카오 지도 앱 실행

## 기능

### 검색 & 필터
- 지역별 필터링 (서울 19개 구역, 수도권)
- 카테고리별 필터링 (밥, 면, 카페, 술안주 등 10개 대분류)
- AI 자연어 검색 (Gemini 기반)
- 이벤트 배너 필터 (흑백요리사 등)

### 지도 연동
- 카카오 지도 통합
- 카테고리별 커스텀 마커
- 네이버/카카오 앱 딥링크
- 웹 지도 fallback

### 장소 정보
- 평점, 메모, 한줄평
- 장소 특징 태그 (혼밥 가능, 조용함, 웨이팅 짧음 등)
- 이미지 갤러리
- 커뮤니티 리뷰

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Maps | Kakao Maps API |
| AI/LLM | LangChain + Google Gemini |
| Images | Cloudinary |
| Deployment | Vercel |

## 개발 환경 설정

### 요구사항
- Node.js 18+
- npm 또는 yarn

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-username/JWMAP.git
cd JWMAP/project

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 API 키 입력

# 개발 서버 실행
npm run dev
```

### 환경변수

```bash
# Kakao Maps
VITE_KAKAO_APP_API_KEY=
VITE_KAKAO_RESTFUL_API_KEY=

# Naver Maps
VITE_NAVER_CLIENT_ID=
VITE_NAVER_CLIENT_SECRET=

# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=

# Vercel API용 (대시보드에서 설정)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GOOGLE_API_KEY=
```

## 스크립트

```bash
npm run dev      # 개발 서버 실행
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 미리보기
npm run lint     # ESLint 검사
```

## 프로젝트 구조

```
project/
├── src/
│   ├── App.tsx              # 메인 앱
│   ├── components/          # React 컴포넌트
│   │   ├── layout/          # 레이아웃 (Mobile/Desktop)
│   │   ├── Map.tsx          # 카카오 지도
│   │   ├── LocationCard.tsx # 장소 카드
│   │   └── ...
│   ├── hooks/               # 커스텀 훅
│   ├── types/               # TypeScript 타입
│   └── utils/               # 유틸리티
├── api/                     # Vercel Serverless Functions
└── public/                  # 정적 파일, 마커 이미지
```

## 라이선스

ISC
