# 오늘 오디가? DB 대규모 개편 계획

> 작성: 2026-10-29 (MacBook 세션, PR #60 머지 직후)
> 실행: macOS(Mac mini)의 Claude 에이전트 세션
> 이 문서가 개편 작업의 기준이다. 새 세션은 **0장 → 2장 → 5장 Phase 0** 순서로 읽고 시작한다.

---

## 0. 이 문서를 읽는 에이전트에게

- 목표: 운영자가 **직접 가본 곳**과 **운영자가 직접 쓴 추천 이유**가 중심인 DB로 다시 짠다.
  외부 자료는 그것을 **보조하는 사실 정보**로만 쓴다.
- 지금 당장 할 일은 5장의 **Phase 0**이다. 모두 **읽기 전용** 작업이다.
- 운영 DB에 쓰기·삭제·스키마 변경을 하기 전에는 반드시 사용자 승인을 받는다 (3장 가드레일).
- 진행 상황은 `.claude/context/TODO_CHECKLIST.md`에 체크하고, 결정은 `.claude/context/CONTEXT_LOG.md`에 남긴다.

---

## 1. 확정된 방향 (사용자 결정, 2026-10-29)

| 항목 | 결정 |
|---|---|
| 서비스 이름 | **오늘 오디가?** (JWMAP은 레포·폴더명일 뿐, 사용자 화면에 노출하지 않음) |
| 기준 색 | **주황** (버튼·면: `orange-500`, 글자: `orange-700` 이상 — 대비 4.5:1 확보) |
| 말투 | **존댓말(해요체)로 통일**. 질문형 추천 화면의 반말 제거 |
| 운영자 캐릭터 | 뚜렷하게 정한다 (미정 — 6장 결정 필요) |
| 브랜드 원칙 | 핵심을 정확히 보여주고, 흐리는 요소는 뺀다 |

브랜드 핵심 = **"직접 가본 사람의 추천 이유를 보고, 나에게 맞는 곳을 골라 바로 찾아간다."**

---

## 2. 현재 DB 진단 (2026-10-29, anon 키 읽기 전용 측정)

### 2-1. 테이블

| 테이블 | 행 수 | 상태 |
|---|---|---|
| `locations` | 962 | 맛집·카페. 사용자 화면의 본체 |
| `attractions` | 133 | 볼거리. `locations`와 컬럼이 거의 같은데 별도 테이블 (`province` 없음, `content_type` 있음) |
| `tags` / `location_tags` | 290 / 222 | 정규화 태그. 그런데 `locations.tags`(text[]) 693곳과 **이중 관리** |
| `attraction_tags` | 512 | 볼거리 태그 |
| `regions` / `categories` / `location_images` | **0 / 0 / 0** | 마이그레이션 001~005로 만들었지만 **비어 있음**. `locations.region_id`·`category_id`도 0 |
| `reviews` | 2 | 방문자 한 줄 리뷰 |
| `user_place_states` | 19 | 방문자 저장/다녀옴 (세션 기반) |
| `click_logs` / `search_logs` / `odiga_search_logs` | 778 / 161 / 10 | 로그 |
| `place_candidates` / `generated_drafts` / `daily_checklist` | 92 / 265 / 22 | jmw-auto-engine 파이프라인 |

### 2-2. `locations` 컬럼 채움 정도 (962곳 기준)

| 컬럼 | 채워진 수 | 문제 |
|---|---|---|
| `curator_visited` | true 451 / false **511** | 절반 이상이 운영자 미방문인데 "직접 다녀온 곳" 약속과 충돌 |
| `short_desc` | 423 | 그중 **335개가 운영자 한 줄이 아니라 주소** → 실제 운영자 한 줄은 88곳 (`audit.mjs` 기준) |
| `memo` | 687 | 그중 **592개가 자동 생성 문구**("주차… 분위기: … 방문 많음"), 488개는 미방문 장소. 생성 스크립트는 레포에서 못 찾음 (확인 불가) |
| `kakao_place_id` | 627 | **방문한 곳 중 329곳에 카카오 ID 없음** |
| `naver_place_id` | **0** | 전혀 없음. 지도 버튼이 이름 검색에 의존 |
| `visit_date` | **1** | 방문일 사실상 없음 → 신뢰 표시(방문일) 불가 |
| `province` | 576 | 386곳 null |
| `category_main` | 958 | **카페 483 + 디저트 162 = 645곳(67%)**. `양식`(80)과 `양식·퓨전`(51) 혼재, `돈까스`·`라멘`이 대분류에 들어감, 빈 문자열 4 |
| `category_sub` | 962 | 57종 |
| `curation_level` | 695 | null 267 |
| `price_level` | 690 | |
| 중복 | | `kakao_place_id` 중복 3, 이름+주소 중복 3 |

### 2-3. 진단 요약

1. **운영자의 목소리가 데이터에 거의 없다.** 운영자 한 줄 88곳, 방문일 1곳.
2. **자동 생성·외부 정보가 운영자 필드에 섞여 있다.** (`short_desc`에 주소, `memo`에 자동 문구)
3. **식별자가 약하다.** 카카오 ID 65%, 네이버 ID 0% → 외부 자료 매칭·길찾기 정확도가 낮다.
4. **분류 체계가 두 벌이다.** 정규화 테이블은 비었고, 텍스트 컬럼이 실제로 쓰인다.
5. **사실상 카페 지도다.** 67%가 카페·디저트 — 브랜드("오늘 오디가?" = 어디서 먹을까)와 비중을 정해야 한다.

---

## 3. 가드레일 (반드시 지킨다)

### 계정·로그인
- 카카오맵 로그인은 **사용자가 직접** 한다. 에이전트는 비밀번호·인증번호를 입력하지 않는다.
- 로그인된 화면에서 **운영자 본인의 저장 장소만** 읽는다. 다른 사람의 프로필·친구 정보는 모으지 않는다.

### 운영 DB
- Phase 0은 읽기 전용. 쓰기·삭제·스키마 변경·마이그레이션 적용은 **사용자 승인 후**에만 한다.
- 변경 전에 반드시 백업(`pg_dump` 또는 Supabase 백업)을 만든다.
- 새 구조는 **새 테이블/스테이징**에 먼저 채우고, 검증 후 전환한다. 기존 테이블을 바로 덮어쓰지 않는다.

### 외부 자료 (네이버·Google·인스타·SNS)
- **공식 API 우선.** 약관이 막는 대량 스크래핑(인스타그램, 구글 지도 페이지 등)은 하지 않는다.
- **남의 글·사진을 저장하지 않는다.** 저장하는 것은 사실 정보(영업시간, 대표 메뉴, 가격대, 주차, 예약 등) + **출처 URL + 수집일**뿐.
  리뷰·블로그는 링크와 짧은 요지만 남긴다.
- 요청 간격을 두고(rate limit), 로봇 차단·CAPTCHA가 나오면 멈추고 사용자에게 알린다.

### 운영자 목소리
- **외부 자료로 "추천 이유"를 쓰지 않는다.** 추천 이유는 운영자가 쓴 글만 공개한다.
- 에이전트가 만드는 것은 **질문지와 초안**까지다. 초안은 `draft`로 저장하고, 운영자가 승인한 것만 공개한다.
- 카카오맵 저장 장소에 운영자가 남긴 메모는 운영자 목소리로 본다 (초안의 가장 좋은 재료).

---

## 4. 목표 데이터 모델 (제안 — Phase 1에서 확정)

```
places                -- 장소 원장 (locations + attractions 통합)
  id, kind('food'|'cafe'|'sight'), name, address, lat, lon,
  province, region, sub_region, category_main, category_sub,
  kakao_place_id (unique), naver_place_id, google_place_id,
  status('visited'|'candidate'|'hidden'), created_at, updated_at

operator_notes        -- 운영자 목소리 (공개되는 추천 이유)
  place_id, one_liner, body, status('draft'|'approved'),
  source('operator'|'kakao_memo'|'agent_draft'), approved_at

operator_visits       -- 방문 기록 = 신뢰 표시
  place_id, visited_on, slot('점심'|'저녁'|'늦은밤'...), disclosure('paid'|'invited'|'sponsored')

place_facts           -- 외부 사실 정보 (출처 필수)
  place_id, field('hours'|'menu'|'price'|'parking'|'reservation'|...),
  value(jsonb), source('kakao'|'naver'|'google'|'instagram'|'blog'|'manual'),
  source_url, fetched_at, confidence

place_refs            -- 외부 언급 링크 (원문 저장 X)
  place_id, source, url, title, summary(짧은 요지), fetched_at

kakao_saved_items     -- 카카오맵 저장 장소 원본 스냅샷 (Phase 0 산출물)
  folder_name, kakao_place_id, name, address, kakao_memo, saved_at, collected_at

tags / place_tags     -- 하나만 남긴다. type: 'mood'(데이트·조용) | 'practical'(주차·포장·예약)
```

원칙:
- 운영자 필드(`operator_notes`, `operator_visits`)와 외부 필드(`place_facts`, `place_refs`)를 **테이블 단위로 분리**한다.
- 화면의 "추천 이유"는 `operator_notes.status = 'approved'`만 쓴다.
- 비어 있는 `regions`·`categories`·`location_images`는 쓸지 지울지 Phase 1에서 결정한다.

---

## 5. 단계별 계획

### Phase 0 — 지금 당장 (macOS, 읽기 전용)

| # | 작업 | 산출물 | 완료 기준 |
|---|---|---|---|
| 0-1 | Mac mini에서 레포 최신화 (`git pull`), `project/.env` 준비 | — | `npm test`(project) 통과 |
| 0-2 | 현재 DB 백업 | `backups/2026-xx-xx/*.sql` 또는 Supabase 백업 확인 | 복원 가능한 백업 위치를 사용자에게 보고 |
| 0-3 | `node docs/db-overhaul/audit.mjs > docs/db-overhaul/audit-YYYY-MM-DD.md` 로 2장 수치 재측정 | `docs/db-overhaul/audit-YYYY-MM-DD.md` | 2장 표와 비교한 차이 기록 |
| 0-4 | **카카오맵 저장 장소 수집**: 사용자가 로그인 → 에이전트가 모든 즐겨찾기 폴더의 장소를 읽음 | `data/kakao-saved/kakao_saved_items.json` (+ csv) | 폴더별 개수 = 카카오맵 화면 개수 |
| 0-5 | 기존 DB와 대조 | `docs/db-overhaul/kakao-diff.md` | 아래 4개 분류 개수 확정 |

0-4 수집 항목 (장소마다):
`folder_name, kakao_place_id, name, address, category, kakao_memo, lat, lon, collected_at`
- 카카오 장소 ID는 장소 상세 URL(`place.map.kakao.com/{id}`)에서 얻는다.
- 공식 내보내기 기능이 있으면 그것을 먼저 쓰고, 없으면 로그인된 화면을 읽는다. 화면을 빠르게 반복 호출하지 않는다.
- `data/kakao-saved/`는 개인 데이터이므로 **git에 올리지 않는다** (`.gitignore` 추가).

0-5 대조 분류:
1. 카카오 저장 O / DB O → 매칭됨 (ID 보강 대상)
2. 카카오 저장 O / DB X → **새로 넣을 후보**
3. 카카오 저장 X / DB O (방문) → 운영자 확인 필요
4. 카카오 저장 X / DB O (미방문) → 숨김·삭제 후보

매칭 순서: `kakao_place_id` 일치 → 이름+좌표(50m 이내) → 이름+주소 정규화.

**Phase 0 끝에서 멈추고 사용자에게 보고한다.** (분류별 개수, 예시 10개씩, 6장 결정 요청)

### Phase 1 — 스키마 확정 (승인 필요)
- 4장 모델을 사용자와 확정 → `admin/supabase/migrations/018_*.sql`로 작성.
- **새 테이블만 추가**. 기존 `locations`·`attractions`는 그대로 둔다.
- 스테이징(Supabase 브랜치 또는 별도 프로젝트)에 먼저 적용해 검증.

### Phase 2 — 원장 채우기 (승인 필요)
- `kakao_saved_items` → `places`(카카오 ID 기준) 생성/매칭.
- 기존 `locations`·`attractions`에서 이관: 운영자 필드는 `operator_notes`/`operator_visits`로,
  자동 메모·주소는 `place_facts`로 옮기거나 버린다. `short_desc`의 주소 335건은 `address`와 비교 후 폐기.
- 카테고리 정리: `양식`/`양식·퓨전` 통합, `돈까스`·`라멘`은 소분류로, 빈 값 정리.

### Phase 3 — 외부 사실 정보 보강

| 소스 | 방법 | 저장 | 비고 |
|---|---|---|---|
| 카카오 | 장소 상세 / Kakao Local API | 주소, 좌표, 전화, 카테고리, 영업시간(가능 시) | ID가 있으니 가장 정확 |
| 네이버 | 네이버 검색 API(지역·블로그) | `naver_place_id`(링크 매칭), 블로그는 `place_refs`(링크·요지) | API 결과 개수 제한 확인 필요 |
| Google | Places API (유료·키 필요) | `google_place_id`, 영업시간, 가격대 | 약관상 캐시 가능한 필드 확인 후 저장 |
| 인스타·SNS | **수집 자동화 안 함.** 운영자가 참고할 링크를 수동으로 `place_refs`에 추가 | 링크만 | 공식 API는 비즈니스 계정·심사 필요 |

- 모든 값은 `source_url`·`fetched_at`과 함께 저장한다. 충돌 시 카카오 > 네이버 > Google 순으로 본다.
- 비용이 드는 API(Google)는 실행 전 예상 호출 수·비용을 사용자에게 보고하고 승인받는다.

### Phase 4 — 운영자 작성 (운영자 시간 필요)
- 방문한 곳마다 **작성 시트** 생성: 장소 정보 + 카카오 메모 + 외부 사실 + 질문 3개
  (예: "무엇을 먹었나요?", "누구와 가기 좋나요?", "아쉬운 점은?").
- 에이전트 초안은 `operator_notes(status='draft', source='agent_draft')`로만 저장.
  운영자가 고치고 승인해야 공개된다.
- 우선순위: 대표픽 → 방문했지만 한 줄 없는 곳 → 나머지.

### Phase 5 — 화면 전환 (승인 필요)
- 사용자 웹(`project/`)이 `places` + `operator_notes(approved)`를 읽도록 전환.
- 브랜드 정리: 화면의 `JWMAP` 표기 제거 → `오늘 오디가?`, 반말 → 해요체, 글자 주황 대비 보정.
- 미방문 처리(6장 결정)에 따라 숨김 적용. 지도 버튼은 장소 ID 기반 딥링크로.
- 전환 후 기존 테이블은 읽기 전용으로 두고, 일정 기간 뒤 정리.

### 추후
- jmw-auto-engine의 후보 수집(`place_candidates`)이 `places(status='candidate')` + `place_facts`로 들어오게 연결.
  자동 엔진은 **운영자 필드에 쓰지 않는다.**
- 방문 기록 입력 UX (admin에서 방문일·공개 유형·한 줄 빠르게 입력).

---

## 6. 사용자 결정이 필요한 것 (Phase 0 보고 때 함께 묻기)

1. **미방문 511곳**: 사용자 화면에서 완전히 뺄지 / "아직 안 가본 후보"로 따로 둘지
2. **운영자 이름**: 닉네임을 둘지(`쩝쩝박사` 등) / "제가"만 쓸지
3. **카페 비중 67%**: 카페를 별도 모드로 분리할지, 그대로 함께 둘지
4. **`locations` + `attractions` 통합** 여부 (제안: `places.kind`로 통합)
5. **비어 있는 정규화 테이블**(`regions`·`categories`·`location_images`) 사용/삭제
6. **Google Places API** 사용 여부와 예산

---

## 7. 참고

- 진단 근거: 이번 세션의 UX 진단과 PR #60 (이슈 #59)
- 이미 반영된 화면 규칙 (PR #60):
  - 추천 이유 = `short_desc`만, 주소처럼 보이는 값 제외 (`project/src/utils/curation.ts` `getCuratorReason`)
  - 주차·포장·예약 태그 = 방문 정보 (`isPracticalInfoTag`)
  - 방문 상태 문구 `운영자 직접 방문` / `아직 안 가본 후보`
- 작업 규칙: 커밋 서명 없음, GitHub Actions CI를 추가하거나 기다리지 않음 (로컬에서 lint/test/build), 운영 DB 쓰기는 승인 후.
