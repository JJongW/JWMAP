# 오늘 오디가?

> 직접 가본 장소만 수록하는 큐레이션 지도 + AI 추천 CLI

서울/수도권 맛집·카페·볼거리를 빠르게 결정하고 바로 출발할 수 있도록 돕는 서비스입니다.

---

## CLI 설치 및 사용법

터미널에서 자연어로 장소·코스를 추천받을 수 있습니다.

### 설치

```bash
npm install -g odiga   # v1.3.0
```

### 사용법

```bash
# 장소 추천
odiga "홍대 점심 뭐 먹지?"
odiga "강남 혼밥 맛집"
odiga "용산 분위기 좋은 카페"

# 코스 추천 (맛집 + 카페 + 볼거리 포함)
odiga "연희동 데이트 코스 짜줘"
odiga "혼자 용산 산책 코스"

# 통계
odiga stats
```

### 추천 흐름

1. 자연어 검색 → AI가 의도를 파악해 장소 또는 코스를 추천
2. 목록에서 선택 → 상세 정보 + 네이버/카카오 지도 링크
3. 코스 모드 → 각 장소별 `왜 여기` / `순서 이유` 큐레이션 텍스트 제공
4. `다시 추천받기` → 피드백 기반 재추천

---

## 웹 서비스

### 주요 기능

- **검증된 장소만**: 운영자가 직접 방문하고 검증한 맛집·카페·볼거리 수록
- **자연어 검색**: "용산 혼밥 맛집" 같은 자연스러운 검색 지원
- **빠른 결정**: 한눈에 파악하는 카테고리와 필터
- **지도 앱 연동**: 탭 한 번으로 네이버/카카오 지도 앱 실행

### 검색 & 필터

- 지역별 필터링 (서울 19개 구역, 수도권)
- 카테고리별 필터링 (밥·면·카페·볼거리 등 10개 대분류)
- AI 자연어 검색 (Gemini 기반)

### 지도 연동

- 카카오 지도 통합 + 카테고리별 커스텀 마커
- 네이버/카카오 앱 딥링크
- 웹 지도 fallback

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Admin | Next.js 16 (App Router) |
| CLI | Node.js ESM, Enquirer, Chalk |
| API | Vercel Serverless Functions |
| Database | Supabase (PostgreSQL) |
| Maps | Kakao Maps API |
| AI/LLM | LangChain + Google Gemini 2.0 Flash |
| Images | Cloudinary |
| Deployment | Vercel |

## 라이선스

MIT
