# JWMAP Admin

jmw-auto-engine과 연동되는 콘텐츠 관리 대시보드.
Next.js 16 App Router 기반으로 Supabase 공유 DB를 읽고 씁니다.

## 주요 기능

- **콘텐츠 엔진 대시보드** — 최근 초안, 트렌드 리포트, 통계 현황
- **초안 관리** — `draft → approved → published / rejected` 상태 전환
- **트렌드 리포트** — 일별 AI 분석 결과 (장소 후보, 키워드, 톤) 조회
- **장소 관리** — JWMAP `locations` 테이블 CRUD

## 기술 스택

- **Framework**: Next.js 16 App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL, service_role)
- **Testing**: Vitest (unit), Playwright (E2E)
- **Deployment**: Vercel

## 개발

```bash
cd admin
npm install
npm run dev      # localhost:3000
npm run build
npm run test     # Vitest
npm run test:e2e # Playwright
```

## 환경 변수

`admin/.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # 서버 사이드 전용
```

## 프로젝트 구조

```
admin/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # 대시보드 홈
│   ├── drafts/                   # 초안 관리
│   │   └── page.tsx
│   ├── reports/                  # 트렌드 리포트
│   │   └── page.tsx
│   └── api/                      # Route Handlers
│       ├── drafts/route.ts
│       ├── reports/route.ts
│       └── locations/route.ts
├── components/
├── lib/
│   └── supabase.ts               # Supabase 클라이언트
├── supabase/
│   └── migrations/               # DB 마이그레이션 SQL
└── tests/
    ├── unit/                     # Vitest 단위 테스트
    └── e2e/                      # Playwright E2E 테스트
```

## DB 테이블 (Supabase 공유)

admin에서 읽고 쓰는 테이블:

| 테이블 | 권한 | 설명 |
|---|---|---|
| `generated_drafts` | 읽기/쓰기 | 콘텐츠 초안 (caption, hashtags, status) |
| `daily_trend_reports` | 읽기 | 일별 트렌드 분석 결과 |
| `raw_sns_posts` | 읽기 | 수집된 SNS 원본 |
| `place_candidates` | 읽기 | AI 추출 장소 후보 |
| `locations` | 읽기/쓰기 | JWMAP 장소 데이터 |

마이그레이션은 `admin/supabase/migrations/` 에서 관리.
