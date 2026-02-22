# odiga - 오늘 어디가?

AI 기반 맛집/장소 추천 & 코스 플래닝 CLI 도구.

자연어로 검색하면 서버의 Gemini가 의도를 파악하고, 장소/볼거리를 찾아 스코어링 기반으로 추천합니다.
**.env 설정 불필요** — 설치 후 바로 사용 가능!

## 기능

- **장소 추천** — "오늘 점심 뭐 먹을까?", "홍대 감성 카페"
- **코스 추천** — "강남 데이트 코스 짜줘", "혼자 산책 코스" (맛집 + 볼거리 혼합)
- **통계 대시보드** — 검색 패턴, 인기 지역, 시간대별 분석

## 설치

```bash
npm install -g odiga@1.3.0
```

요구 사항: Node.js >= 18

## 사용법

```bash
# 장소 추천
odiga "오늘 점심 뭐 먹을까?"
odiga "홍대 감성 카페"
odiga "강남 혼밥 맛집"

# 코스 추천 (맛집 + 볼거리 포함)
odiga "강남 데이트 코스 짜줘"
odiga "용산 친구랑 먹방 코스"

# 통계
odiga stats
```

### 장소 추천 모드

단일 장소를 찾을 때 자동으로 활성화됩니다.

```
  1. 히코 라멘  면 > 라멘
     진한 돈코츠 라멘 맛집
     📍 강남구 역삼동  ⭐ 4.5  매칭 8.2점

  2. 스시 사이토  해산물 > 회
     ...

? 어디로 갈까요?
  1번 장소 상세보기
  2번 장소 상세보기
  다시 추천받기
```

### 코스 추천 모드

"코스", "짜줘" 등의 키워드가 포함되면 활성화됩니다.
맛집(`locations`)과 볼거리(`attractions`) 장소를 혼합하여 코스를 구성합니다.

```
  코스 난이도: ★☆☆ ~800m  ★★☆ ~1.8km  ★★★ 1.8km+

  ── 코스 1 ──
  🔥 오늘오디가의 제안
  강남, 데이트 하기 좋은 오후 코스

  흐름: 히코 라멘 → 카페 온도 → 선릉 순례길
  이런 날: 여유로운 주말 오후, 걷기 좋은 날씨

  — 흐름 —
  [1] 히코 라멘
     왜 여기: 담백한 돈코츠로 든든하게 시작
     순서 이유: 점심 타이밍에 웨이팅이 가장 짧음
  [2] 카페 온도
     왜 여기: 식후 커피로 분위기 전환
     순서 이유: 라멘집에서 도보 3분 거리
  [3] 선릉 순례길
     왜 여기: 산책하며 대화 이어가기 좋음
     순서 이유: 카페 바로 옆, 마무리로 최적

  확신도: 높음

? 어떤 코스로 가볼까요?
```

## 아키텍처

```
CLI (npm package)  →  HTTP  →  Vercel Serverless API  →  Supabase + Gemini
```

CLI는 공개 API 서버(`https://odiga.vercel.app/api`)와 통신합니다.
API 키나 DB 설정 없이 `npm install -g odiga` 한 번이면 됩니다.

### 환경 변수 (선택)

```bash
# API URL을 오버라이드하려면 (개발/셀프호스팅)
ODIGA_API_URL=http://localhost:3000/api
```

## 개발

```bash
cd odiga
npm install
npm run dev -- "검색어"    # tsx로 직접 실행
npm run build              # 빌드
npm start -- "검색어"      # 빌드 후 실행
```

## 프로젝트 구조

```
odiga/                          # CLI npm 패키지
├── src/
│   ├── index.ts              # CLI 진입점
│   ├── api/
│   │   ├── client.ts         # HTTP API 클라이언트
│   │   └── types.ts          # 요청/응답 타입 (BrandedCourse, curation_text 등)
│   ├── ui/
│   │   ├── renderer.ts       # CLI 출력 (curation_text 기반 코스 렌더링)
│   │   ├── prompts.ts        # 사용자 입력
│   │   └── colors.ts         # Apricot Orange 브랜드 색상 (#FF8A3D)
│   └── utils/
│       ├── mapLink.ts        # 네이버/카카오 딥링크
│       └── validators.ts     # 입력 검증
├── .env.example
├── package.json
└── tsconfig.json

odiga-api/                      # Vercel Serverless API (별도 디렉토리)
├── api/
│   ├── recommend.ts          # 메인 추천 파이프라인
│   ├── log.ts                # 검색 로그 기록
│   ├── stats.ts              # 통계 조회
│   └── save-course.ts        # 코스 저장
└── lib/
    ├── curation.ts           # LLM 큐레이션 (장소: JSON, 코스: 텍스트 포맷)
    ├── scoring.ts            # 스코어링 엔진
    ├── intentParser.ts       # 자연어 → ParsedIntent
    └── supabase.ts           # DB 클라이언트
```

## API 엔드포인트

베이스 URL: `https://odiga.vercel.app/api`

| 엔드포인트 | Method | Rate Limit | 용도 |
|---|---|---|---|
| `/recommend` | POST | 5/min, 100/day | 메인 추천 파이프라인 |
| `/log` | POST | 10/min | 검색 로그 기록 |
| `/stats` | GET | 3/min | 통계 조회 |
| `/save-course` | POST | 5/min | 코스 저장 |

## 기술 스택

- **API**: Vercel Serverless + Google Gemini 2.0 Flash + Supabase
- **CLI**: Enquirer (대화형 프롬프트), Chalk (Apricot Orange 브랜드 컬러)
- **Language**: TypeScript, Node.js ESM
