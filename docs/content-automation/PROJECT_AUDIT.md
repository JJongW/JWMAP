# OOMAP 콘텐츠 자동화 — Phase 0 기존 시스템 감사

## 결정 (2026-11-04, G장 답변)

| 질문 | 결정 | 반영 |
|---|---|---|
| Insights 권한 | 토큰을 새로 발급함 | 확인: `instagram_manage_insights` 있음. 게시물 reach·views·likes·comments·saved·shares·total_interactions·profile_visits·follows 조회됨. 계정 지표는 `metric_type=total_value`로 조회 |
| 렌더링 | **무조건 Figma** | 코드 렌더러를 쓰지 않는다. Phase 6 Figma 무인 PoC가 전체 일정의 첫 관문이다 |
| LLM | Claude CLI(구독) 유지 | 출력은 Zod 스키마로 검증하고, 실패하면 다시 시도 |
| 사진 | 직접 찍은 사진(own)만 | official·web 사진은 자동 결과물에서 제외 |
| 기존 작업·빈도 | 기존 cardNewsJob **제거**(jmw-auto-engine PR #52, launchd 해제). 주 5회 | 원료 40곳 기준 약 8주 분량 → 사진 업로드 적체 해소를 Phase 4에서 먼저 한다 |

아래 E장의 "코드 렌더러 기본" 제안과 "기존 작업 병행" 항목은 이 결정으로 대체됐다.

작성 2026-11-04 · 상태: 설계 검토 요청 (구현 전, 운영 변경 없음)
측정은 전부 읽기 전용. 운영 DB에는 SELECT만 했다. 인스타그램에는 게시하지 않은 테스트 컨테이너가 1건 생겼고, 24시간 뒤 자동으로 만료된다.

---

## A. 현재 시스템

### A-1. 레포와 실행 위치

| 구성 | 위치 | 기술 | 배포·실행 |
|---|---|---|---|
| 사용자 웹 oomap.kr | `JWMAP/project` | React 18 + Vite, `/api/search` 서버리스 | Vercel |
| admin | `JWMAP/admin` | Next.js 16.1 App Router, React 19, shadcn, Recharts | Vercel (jwmap.vercel.app) |
| odiga CLI / API | `JWMAP/odiga`, `JWMAP/odiga-api` | Node ESM / Vercel Functions | npm / Vercel |
| 자동화 엔진 | `ted.urssu/jmw-auto-engine` (별도 레포) | Node + TS, Claude CLI, Playwright | **Mac mini launchd** |
| 콘텐츠 원장(볼트) | 외장 HDD `/Volumes/One Touch/작업 폴더/odiga` | Markdown + Python(Pillow) | Mac mini 로컬 |
| DB | Supabase 1개 (모든 구성이 공유) | Postgres + RLS | 클라우드 |
| 이미지 | Cloudinary (직접 찍은 사진 377장), 카카오 CDN 링크 | | |

### A-2. 데이터 (2026-11-04 실측)

새 큐레이션 모델(018~030)이 기준이다. 예전 `locations`/`attractions`는 022 트리거로 한 방향 동기화만 된다.

| 테이블 | 행 | 비고 |
|---|---|---|
| `places` | 1,240 | 방문함 597 · 후보 608 · 숨김 35, 폐업 23 |
| `visits` | 638 | 방문 기록 |
| `recommendations` | 667 | 공개 492 · 초안 175 (운영자 추천 이유) |
| `place_photos` | 12,936 | 장소에 연결된 건 5,098장: 직접 찍음(own) 1,387 · 가게 공식(official, 카카오 CDN) 3,711 |
| `external_reviews` | 23,582 | 카카오 등에서 발췌 |
| `place_facts` | 4,683 | 시설 정보 (unverified/verified/outdated, 출처, 확인 시각) |
| `taxonomy_terms` / `place_terms` | 35 / 2,092 | 장소 종류·이유·상황 분류 (계층 `parent_id` 있음) |
| `place_intake` | 2,675 | 검토함 |
| `generated_drafts` / `place_candidates` / `raw_sns_posts` / `daily_trend_reports` | 282 / 94 / 1,755 / 137 | 예전 트렌드·캡션 엔진 |
| `agent_tasks` / `execution_logs` | 2 / 2 | 승인 게이트 (oomap MCP) |

**지역**: `province` → `region`(예: `구로/관악/동작` 같은 묶음 15개 정도) → `sub_region`(희박). **역세권은 데이터에 없다.** 좌표(lat/lon)는 전부 있다.
**카테고리**: `category_main/sub` 표기가 섞여 있다(`양식`, `양식·퓨전`, `음식점 > 양식 > 이탈리안`). 정리된 분류는 `taxonomy_terms` + `place_terms`에 있다.

### A-3. 콘텐츠로 바로 쓸 수 있는 장소 — 이게 가장 큰 제약이다

조건: 방문함 + 영업 중 + 공개 추천 이유 + Cloudinary에 올라간 직접 찍은 사진 3장 이상

- **40곳** (공개 추천이 있는 방문 장소 484곳 중)
- 지역: 용산·이태원·한남 8, 홍대·합정 7, 신촌·연희 5, 성수 5, 종로 5, 관악·동작 4, 강남 3 …
- 종류: 카페 22, 양식 4, 나머지는 1~2곳씩
- 직접 찍은 사진 1,387장 중 약 1,010장은 아직 업로드 전이다(로컬 경로만 있음). 올리면 대상이 늘어난다.
- 가게 공식 사진 3,711장은 카카오 CDN 링크라 **사용 권리가 없다** → 콘텐츠에 쓸 수 없다.

→ "사당역 국밥 BEST 5" 같은 지역+종류 묶음은 **지금 데이터로는 만들 수 없다** (한 지역·한 종류에 준비된 곳이 5곳 되는 조합이 없다). 당장 가능한 건 단일 장소 소개, 또는 "연희·신촌 카페 3곳" 수준이다.

### A-4. 이미 돌아가는 카드뉴스 자동화

`jmw-auto-engine/src/jobs/cardNewsJob.ts`

- **launchd가 매일 06:30에 실행**한다 (`com.jmw.auto-engine.cardnews`).
- 하는 일: `claude -p` 에이전트(45분 제한)가 HDD 볼트 `01_Places`에서 카페를 고르고, 공개 리뷰를 조사하고, `05_Library/Copy-Library`를 읽고 문구를 쓴다. 그다음 볼트의 Pillow 스크립트(`generate_instagram_cardnews.py`, 1080×1350)로 렌더링한다.
- 결과물은 `03_Content/social/Instagram/<날짜 - 지역 - 장소>/`에 생긴다: 카드 이미지, preview, caption, manifest.
- 실적: published 4회 (10-25, 10-26, 10-27, 11-01), skipped 7회.
- **한계**
  - DB와 연결되지 않았다. 장소 id, 콘텐츠 기록, admin 검토 모두 없다.
  - 결과가 로컬 HDD에만 있다.
  - 실행 상태가 단계별로 남지 않는다.
  - 재시도·중간 재개가 없다.

### A-5. 이미 있는 자동화 장치

- **launchd 실행**: daily 07/12/18시, cardnews 06:30, oomap-tasks 60초마다. 로그는 `jmw-auto-engine/logs/`에 쌓인다.
- **LLM 호출**: 전부 Claude CLI(`claude -p --output-format json`, 구독 인증)로 한다. Anthropic API 키나 SDK는 없다. 결과 JSON을 스키마로 검증하지 않는다(정규식으로 추출).
- **승인 게이트**: `agent_tasks`의 상태가 proposed → approved → executing → done/failed 순으로 바뀐다. `assertApproved`와 명령 화이트리스트가 있다.
  - 원자적 점유(lock), 재시도, 멱등 키가 없다.
- **oomap MCP**: 읽기 도구 5개(intake·place·review·task), 계획 도구 4개, task_approve/task_run.
- **admin 화면**:
  - 메뉴: 검토함, 맛집·카페, 볼거리, 확인 필요, 승인 대기(`/tasks`), 코스, 리뷰, 콘텐츠 엔진(`/content-engine`: 후보·초안·트렌드), 오늘 할 일, odiga 분석
  - 인증: Supabase Auth + `private.admin_users` + RLS(020). 가입은 막혀 있다.
- **사용자 웹·admin 코드에는 인스타 Graph API나 Figma 연동이 없다.**

### A-6. 인스타그램 (이 세션에서 실측)

| 항목 | 결과 |
|---|---|
| 토큰 | 페이스북 시스템 유저 토큰. 권한: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages` |
| 프로필·게시물 목록 | 됨. @chyubeleub_j, 게시물 66개, 좋아요·댓글 수까지 |
| 게시 | 됨. 컨테이너 생성까지 확인, 24시간 한도 100 |
| **Insights (reach·views·saved·shares·계정 지표)** | **안 됨 — `(#10) Application does not have permission`**. `instagram_manage_insights` 권한이 없다 |
| 다른 계정 조회 (business_discovery) | 안 됨 |
| 토큰 만료 | 알 수 없음 (debug_token에 앱 토큰이 필요) |

요구서의 "Insights 실제 조회 성공"은 지금 `.env` 토큰 기준으로는 사실이 아니다. 다른 토큰으로 성공한 것일 수 있다.

### A-7. Figma

- MCP 연결 계정: ted 19, Pro 팀 Full 시트.
- 레포 안에는 Figma 템플릿도, 연동 코드도 없다.

### A-8. 발견한 결함 (이번 작업과 별개)

- `place_candidates.markConsumed`가 운영 DB check 제약을 위반한다. 운영 DB에는 `consumed` 상태가 없다. 그래서 같은 후보("농민 백암순대 본점")로 초안이 28번 생성됐다.
- `executionEngine`의 approved→executing 전환이 원자적이지 않다. 실행기가 두 개 돌면 같은 작업을 둘 다 잡을 수 있다.
- SNS 수집기(Google `site:instagram.com`)는 매일 0건이다. 트렌드 엔진 입력이 사실상 비어 있다.
- `CLAUDE.md`(JWMAP·jmw-auto-engine)의 경로·스키마 설명이 옛날 것이다 (`/Users/sjw/...`, Gemini, `locations` 중심).

---

## B. 목표 대비 차이

| 목표 기능 | 상태 | 재사용할 것 |
|---|---|---|
| 장소 데이터 | 있음 | `places`·`visits`·`recommendations`·`place_facts`·`place_terms` |
| 정보 신뢰도·폐업 | 있음 | `business_status`, `place_facts.status/checked_at`, 확인 필요 뷰 |
| 역세권 | **없음** | 좌표만 있음 → 역 좌표 데이터로 계산 |
| 카테고리 계층 | 부분 | `taxonomy_terms.parent_id` (35개, 확장 필요) |
| 이미지 라이브러리 | 부분 | `place_photos` (출처·대표 여부는 있음. 권리·유형·사용 이력·크기는 대부분 비어 있음) |
| 카피 라이브러리 | 볼트 Markdown | HDD `05_Library/Copy-Library` → DB로 옮겨야 함 |
| 콘텐츠·장소 다대다 | **없음** | |
| AI 기획·선정 기록 | **없음** (cardNewsJob은 기록 없이 고름) | |
| 렌더링 | 있음 (Pillow) | 볼트 스크립트 |
| Figma 템플릿 | **없음** | |
| 작업 큐·상태·재시도 | 부분 | launchd, `agent_tasks` 패턴 (lock·재시도 추가 필요) |
| admin 검토·수정·승인 | 부분 | `/content-engine`, `/tasks`, admin 인증 |
| Insights 수집 | **권한 없음** | |
| 성과 분석·피드백 | **없음** | |

---

## C. 권장 아키텍처

새 서버를 따로 만들지 않는다. **Supabase를 중앙 백엔드이자 큐로 쓰고, Mac mini의 jmw-auto-engine을 Worker로 키운다.**

```
admin (Vercel, Next.js)
  │ server actions / route handlers (admin 인증, service role은 서버에만)
  ▼
Supabase ── content_jobs (큐) · content_* · ig_* · place_* (기존)
  ▲   │ RPC claim_content_job() : FOR UPDATE SKIP LOCKED, 하트비트
  │   ▼
Mac mini Worker (jmw-auto-engine, launchd, 아웃바운드만)
  ├ planner      : 후보 생성(SQL/규칙) → 점수 → Claude로 선정·기획 (JSON 스키마 검증)
  ├ copywriter   : 카드 문구·캡션 (Copy Library + 운영자 말투)
  ├ renderer     : 템플릿 → 1080×1350 PNG (기본은 코드 렌더러, D-3 참고)
  ├ qa           : 사실 대조(DB 값과 문구), 글자 넘침, 이미지 권리·중복, 금지어
  ├ uploader     : 결과 이미지 → Storage, content_cards에 URL
  └ ig-collector : 게시물 동기화 + Insights 스냅샷 (권한 받은 뒤)
```

설계 원칙:

1. **장소 원장은 DB 하나**다. 기존 cardNewsJob의 HDD 볼트 선택은 DB `places` 기준으로 바꾼다. 볼트는 사진 원본 보관소와 카피 원천으로만 쓴다.
2. **단계별 산출물을 DB에 저장**한다. 그래야 실패한 단계부터 다시 돌릴 수 있다. 작업 상태도 DB가 기준이다.
3. **게시는 하지 않는다.** 마지막 상태는 `pending_review`다.
4. **사실 문장은 DB에 있는 값으로만 쓴다.**
   - 추천 이유: `recommendations.body`
   - 시설·영업 정보: `place_facts`의 verified 값
   - 근거가 없는 주장은 QA에서 떨어뜨린다.
5. **이미지는 own(직접 찍은 사진)만** 쓴다. official/web 사진은 권리가 확인되기 전까지 자동 결과물에서 뺀다.

---

## D. 데이터베이스 확장 계획 (새 테이블 위주, 기존 테이블은 컬럼 추가만)

| 테이블 | 핵심 컬럼 |
|---|---|
| `place_stations` | place_id, station_id, distance_m, is_primary (좌표로 계산, 한 장소가 여러 역에 걸칠 수 있음) |
| `stations` | 역명, 노선, 좌표 (공공데이터) |
| `place_photos` (+컬럼) | kind(외관·내부·음식·메뉴·공간…), rights(own/licensed/unknown), usable, width/height 채우기, ai_caption |
| `copy_entries` | kind(hook/title/cta/caption/hashtag/pattern), text, tone, category, status, source(vault/operator/ai) |
| `design_templates` | key, version, renderer(code/figma), figma_file_key/node_id, slots JSON 스키마, 글자 제한, 이미지 비율 |
| `content_items` | 주제, 형식, status(planned→…→pending_review→approved→published / rejected), template_id, caption, hashtags, 생성 모델, ig_media_id |
| `content_places` | content_id, place_id, position, card_index, on_cover, role, weight |
| `content_cards` | content_id, index, type(cover/place/map/cta), slots JSON, photo_id, image_url, render_hash |
| `content_jobs` | content_id, step, status, attempts, locked_by, locked_at, heartbeat_at, scheduled_at, idempotency_key, error |
| `ai_decisions` | job_id, candidates JSON(점수 포함), chosen, reason, inputs 요약, strategy(exploit/explore), model, created_at |
| `ig_posts` | ig_media_id, permalink, media_type, caption, published_at, content_id(nullable), match_method, match_confidence |
| `ig_insight_snapshots` | ig_media_id, captured_at, age_hours, metrics JSONB(받은 지표만), api_version |
| `place_performance` (뷰) | 등장 횟수, 지표 평균·편차, 표본 수, 신뢰 구간 (경험적 베이즈 축소) |

- 마이그레이션은 기존처럼 `admin/supabase/migrations/031+`에 둔다. rollback 파일과 PGlite 테스트를 같이 만든다.
- 적용 순서: 개발 DB(PGlite) → 운영. 운영 적용은 승인 후에만 한다.
- RLS: 새 테이블은 모두 admin + service role 전용이다. anon에는 열지 않는다.
- `generated_drafts`·`place_candidates`(예전 트렌드 엔진)는 이번 작업에서 건드리지 않는다. 정리할지는 별도로 결정한다.

---

## E. 기술 위험

| 위험 | 내용 | 대응 |
|---|---|---|
| **Figma 무인 제작** | REST API는 읽기와 이미지 내보내기만 된다. 노드 수정은 안 된다. 편집은 Plugin API로만 된다. 무인 경로는 Figma MCP `use_figma`(원격 Plugin API 실행)뿐인데, Claude 세션 안에서만 동작한다. 또 MCP OAuth 만료, 호출 한도, Figma 쪽 변경에 영향을 받는다. 브라우저 자동화는 로그인·UI 변경에 약하다 | Phase 6 PoC에서 `claude -p` + Figma MCP로 템플릿 복제·텍스트·이미지 교체·내보내기를 무인으로 10회 연속 성공하는지 잰다. 될 때까지 **렌더링 기준은 코드 렌더러**로 두고, Figma는 디자인 원본(토큰·레이아웃 정의)과 선택 사항인 "Figma로 열기" 동기화로 쓴다 |
| **Insights 권한** | `instagram_manage_insights`가 없다 | 시스템 유저 토큰을 그 권한을 넣어 다시 발급받는다. 앱 모드나 심사가 필요한지는 재발급 시 확인 |
| **콘텐츠 원료 부족** | 준비된 곳 40곳, 카페 편중 | 하루 1개면 6주 안에 바닥난다. 사진 업로드 적체(~1,010장) 해소, 주 2~3회 제작, 같은 장소 다른 주제 재사용(실험) |
| **사실 오류** | AI가 메뉴·가격·영업시간을 지어낼 수 있다 | 사실 슬롯은 DB 값만 쓰고, 문장은 슬롯을 참조하게 한다. QA가 DB와 대조한다. 웹 조사 내용은 별도 표시 후 검수 대상으로 둔다 |
| **Mac mini Worker** | 재부팅·HDD 분리·CLI 인증 만료·동시 실행 | launchd KeepAlive, DB 원자적 점유 + 하트비트 + 만료 회수, HDD 없이도 도는 경로(사진은 Cloudinary에서), admin에 Worker 마지막 하트비트 표시 |
| **Claude CLI vs API** | 지금은 구독 CLI로 돈다. 헤드리스 장기 운영 시 인증 만료가 생길 수 있고, 구조화 출력 보장이 약하다 | API 키를 쓰면 structured output과 사용량 추적이 된다(비용 발생). 결정 필요 (G-3) |
| **운영 DB** | 022 동기화 트리거, RLS 020 | 새 테이블만 추가한다. 기존 트리거·정책은 바꾸지 않는다. 마이그레이션마다 rollback과 테스트를 둔다 |
| **기존 cardNewsJob** | 06:30에 계속 돌면 새 파이프라인과 중복된다 | 새 파이프라인이 같은 수준에 오르면 그때 끈다. 그 전까지 병행 |

---

## F. 로드맵 (완료 기준)

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 0.5 | 결함 수정: `consumed` 제약, 실행기 원자적 점유 | 같은 작업을 두 번 잡지 않는 테스트 통과, 같은 후보로 중복 초안이 생기지 않음 |
| 1 | 설계 문서 (아키텍처·ERD·API·Worker) | 사용자 검토 통과 |
| 2 | 마이그레이션 031~ (content_*, ig_*, copy, templates, jobs, decisions, stations) | PGlite 테스트(보존·멱등·RLS·rollback) 통과 → 승인 후 운영 적용 |
| 3 | IG 수집기 (게시물 동기화 + 스냅샷) | 권한 재발급 후 66개 게시물 동기화, 1h/24h/72h/7d/30d 스냅샷이 쌓임. 없는 지표는 null |
| 4 | 사진 정리 + 카피 라이브러리 이관 | own 사진 업로드·크기·유형 채움, Copy-Library → `copy_entries` |
| 5 | Planner | 후보 N개·점수·이유가 `ai_decisions`에 남고, 최근 노출 장소는 제외되고, explore 비율 설정이 반영됨 |
| 6 | 렌더러 + Figma PoC | 코드 렌더러로 1080×1350 카드 생성, 글자 넘침 검사. Figma 무인 10회 결과를 문서화 |
| 7 | 파이프라인 연결 | 예약 1건이 사람 개입 없이 `pending_review`까지 가고, 단계 실패 시 그 단계부터 재개됨 |
| 8 | admin Content Studio | 미리보기, 문구·사진 수정 → 재렌더, 승인·반려, zip 다운로드, 게시물 URL 연결 |
| 9 | Worker 운영화 | launchd, 하트비트, 실패 알림, admin 자동화 화면 |
| 10 | 성과 분석 | 장소·주제·템플릿별 지표와 신뢰 수준, planner 점수에 반영 |

---

## G. 확인이 필요한 것

1. **Insights 권한**: 시스템 유저 토큰에 `instagram_manage_insights`(+`pages_read_engagement`)를 넣어 다시 발급할 수 있는지. 요구서에 쓴 "조회 성공"은 어떤 토큰으로 한 것인지.
2. **렌더링 기준**: 최종 이미지를 꼭 Figma에서 만들어야 하는지, 아니면 코드 렌더러를 기본으로 하고 Figma는 디자인 원본·선택 편집으로 써도 되는지.
3. **LLM 호출**: 지금처럼 Claude CLI(구독)를 쓸지, Anthropic API 키(사용량 과금)를 쓸지.
4. **사진 범위**: 직접 찍은 사진만 쓸지. 가게 공식 사진을 허락받아 쓸 계획이 있는지.
5. **제작 빈도와 기존 작업**: 원료가 40곳인 점을 감안해 주 몇 회로 할지. 기존 06:30 cardNewsJob을 새 파이프라인이 대체할 때까지 계속 둘지.
