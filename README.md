# JWMAP - 밥 먹어야해

서울 맛집 정보를 지도에서 확인할 수 있는 웹 서비스입니다.

## 주요 기능

- 서울 지역별 맛집 필터링
- 카테고리별 맛집 분류
- 카카오 지도 연동으로 위치 확인
- 맛집 추가/삭제 기능
- 반응형 디자인 (모바일/데스크톱 지원)

## 기술 스택

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Kakao Maps API

### Backend
- Supabase (PostgreSQL)

## 설치 및 실행

### 사전 요구사항
- Node.js 18+
- Supabase 계정

### 설치
```bash
cd project
npm install
npm run dev
```

### 환경 변수 설정

`project/.env` 파일을 생성하고 다음 내용을 추가하세요:

```
VITE_KAKAO_APP_API_KEY=your_kakao_api_key
VITE_KAKAO_RESTFUL_API_KEY=your_kakao_restful_api_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase 테이블 설정

Supabase 대시보드에서 `locations` 테이블을 생성하세요:

```sql
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  category TEXT NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  memo TEXT,
  address TEXT NOT NULL,
  rating DOUBLE PRECISION DEFAULT 0,
  imageUrl TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 프로젝트 구조

```
JWMAP/
├── project/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── AddLocationModal.tsx
│   │   │   ├── CategoryButton.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── LocationCard.tsx
│   │   │   └── Map.tsx
│   │   ├── types/
│   │   └── utils/
│   │       └── supabase.ts
│   └── package.json
└── README.md
```

## 배포

Vercel을 통해 배포됩니다.

```bash
cd project
npm run build
```

Vercel 환경 변수에도 동일한 값을 설정해주세요.
