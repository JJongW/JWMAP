# 맥락 노트 (CONTEXT_LOG.md)

> 왜 이런 결정을 했는지 이유와 관련 자료 위치를 기록합니다.
> /plan 실행 시 자동으로 새 항목이 append됩니다.

---

## 결정 기록

<!-- 형식: ## [YYYY-MM-DD] 결정사항 / 이유 / 관련 파일 -->

## [2026-10-29] oomap.kr 첫 경험 개선 6개 항목 (P0~P2)
- 결정: 모바일은 목록 기본 + `지도 보기` 전환. 추천 결과에서 상세를 결과 화면 안에서 연다.
  검색은 큐레이션 36곳이 아니라 필터 적용된 전체 장소 대상.
  추천 이유는 `short_desc`만, 자동 생성 `memo`·주소·주차는 `방문 정보`로.
- 이유: UX 진단에서 390×667 목록 가시 영역 0px 측정, `handleDecisionOpenDetail`이 장소를 버림,
  13ad4c9의 memo 폴백이 주차 문구를 추천 이유로 노출(전체 보기 91개 중 34개).
- 대안: 지도+목록 동시 노출 유지하며 높이만 조정 → 390×667에서 카드 1장도 확보 어려워 기각.
- 관련 파일: project/src/components/BrowseView.tsx, App.tsx, hooks/useBrowseViewController.ts

## [2026-10-29] 자연어 입력은 규칙 기반 + 실패 시 /api/search
- 결정: `intentChips.ts`에서 키워드 사전으로 지역·누구와·시간·분위기를 뽑고,
  하나도 못 잡으면 기존 Gemini `/api/search`의 slots를 같은 칩으로 매핑.
- 이유: 결정 엔진 입력(Companion/TimeSlot/PriorityFeature)과 1:1이라 즉시·무료.
  표현이 넓은 문장만 API로 보충. (사용자 선택)
- 대안: API만 사용(비용·지연), 규칙만 사용(표현 폭 좁음).
- 갈아탈 신호: API 폴백 비율이 높아지면 규칙 사전 확장 또는 API 우선으로 전환.
- 관련 파일: project/src/utils/intentChips.ts, project/api/search.ts

## [2026-10-29] DB 대규모 개편 방향
- 결정: 운영자 목소리(operator_notes/visits)와 외부 사실 정보(place_facts/refs)를 테이블 단위로 분리.
  카카오맵 저장 장소를 원장의 출발점으로 삼는다. 외부 자료는 공식 API 우선, 원문·사진 저장 금지(사실+출처 URL만).
- 이유: 감사 결과 운영자 한 줄 88곳, short_desc 주소 335개, 자동 메모 592개, 방문일 1곳, naver_place_id 0개,
  카페·디저트 67%. 운영자 목소리가 데이터에 거의 없고 자동·외부 정보가 섞여 있음.
- 대안: 기존 locations 컬럼을 고쳐 쓰기 → 출처 구분이 안 돼 같은 문제 반복, 기각.
- 관련 파일: docs/db-overhaul/README.md, docs/db-overhaul/audit.mjs

## [2026-10-29] 브랜드 결정
- 결정: 서비스명 오늘 오디가?(JWMAP은 레포명), 기준 색 주황, 말투 해요체 통일, 운영자 캐릭터 정립 예정.
- 메모: 주황이 식욕을 직접 올린다는 근거는 약함 → "음식과 온기를 떠올리게 하는 색"으로 설명. 글자는 orange-700 이상(대비).

## [2026-10-29] DB 백업(0-2)을 Phase 2 직전으로 연기
- 이유: Phase 0은 읽기 전용이라 DB가 바뀌지 않음. 백업은 첫 운영 DB 쓰기(Phase 2 이관) 직전에만 있으면 됨. Mac mini에 `pg_dump` 없음, Supabase CLI 미연결.
- 관련: docs/db-overhaul/README.md 5장, TODO_CHECKLIST.md

## [2026-10-29] Phase 0-3 감사 재측정 완료
- 결과: docs/db-overhaul/audit-2026-10-29.md — README 2장 수치와 동일 (`click_logs`만 +3)
- 새로 발견: `province` 정식/줄임 명칭 혼재 (제주특별자치도·전북특별자치도) → Phase 2 정리 대상

## [2026-10-29] oomap.kr 추천 신뢰도 정리 (project/)
- 결정: 추천 강도 배지는 '운영자 직접 방문 + curation_level 3 이상'에만 붙인다 (L3 '운영자 추천', L4+ '대표픽'). 미방문 후보에는 강도 배지를 달지 않는다.
- 이유: 미방문 105곳이 '검증됨'으로 보여 방문 주장처럼 읽혔음. 데이터(curation_level)는 지우지 않고 표시만 바꿈.
- 결정: 볼거리·맛집은 같은 조건 값(lunch·wait_short 등)을 쓰되, 라벨과 매칭 키워드를 모드별로 한 곳(intentChips)에서 정의한다.
- 대안: 볼거리 전용 조건 타입 신설 → 변경 범위가 커서 보류.
- 결정: 운영자 한 줄이 없으면 이유 문장을 만들지 않고 "아직 운영자 한 줄이 없어요"로 둔다. 근거는 '고른 조건과 맞는 점'(#태그)으로만 보여준다.
- 결정: '3곳만 추려보기' → 숫자 없는 '조건 골라 추천받기'. 결과는 1순위+대안+식후 카페로 개수가 달라서.
- 관련 파일: project/src/utils/{intentChips,decisionEngine,curation}.ts, components/{BrowseView,DecisionResultView,DecisionEntryView,ConditionChips,PlaceDetail}.tsx

## [2026-10-29] 큐레이션 모델 018/019 (개발 DB만)
- 결정: 기존 테이블은 두고 places·visits·recommendations·taxonomy_terms·place_terms·place_facts·source_notes 를 추가. places.id = 원본 id.
- 결정: 분류 사전은 project/src/utils/taxonomy.ts 하나. 019 seed는 여기서 생성하고 admin 테스트가 같은지 확인.
- 결정: memo는 외부 소개·자동 수집 문구가 섞여 있어 운영자 글로 단정하지 않음(unknown). 화면의 '직접 가본 메모'는 직접 방문 + 자동 문구 아님일 때만.
- 결정: Docker가 없어 개발 DB는 PGlite(@electric-sql/pglite 0.5.10, admin devDependency).
- 대안: places로 화면 전환 → 운영 반영 전이라 보류. 화면은 기존 테이블 + 같은 분류 사전으로 이유·상황 검색.
- 관련: docs/db-overhaul/curation-model.md, admin/supabase/migrations/018·019, admin/supabase/tests/curation-model.test.ts

## [2026-10-29] admin 문구·입력 흐름 정리
- 결정: admin LocationForm/추천 강도/목록·필터 문구를 사용자 웹과 같은 말로 (장소 종류·추천하는 이유·직접 가본 기록·추천 강도).
- 결정: 빠른 입력 보조가 지도 후기를 short_desc(추천하는 이유)에 넣던 것 중단 → memo 의 '- 지도 소개:/- 리뷰:' 참고 정보로만.
- 결정: 코스 빌더(/api/courses/build)는 운영자 한줄느낌을 short_desc 로 그대로 쓰고, 기존 장소의 short_desc·memo·curator_visited·curation_level 은 덮어쓰지 않음.
- 미결: 코스 빌더가 새 장소를 curator_visited=true 로 만드는 것 유지 여부.
- admin 주소: https://jwmap.vercel.app (사용자 웹: jw-map-project.vercel.app / oomap.kr)

## [2026-10-29] RLS 정리 (020)
- 결정: public 테이블 전부 RLS ON. anon은 장소·태그·리뷰 읽기 + 리뷰/클릭/검색 로그 기록만. 쓰기·운영 데이터는 private.admin_users(적용 시점 auth.users로 채움) 계정만. 엔진 테이블은 service role 전용.
- 이유: Supabase CRITICAL 경고(rls_disabled_in_public, sensitive_columns_exposed). anon 공개 키로 attractions 삭제 등 가능했음.
- 사용자 결정: 신규 가입 끄기, 사이트의 숨은 장소 추가 기능은 막고 admin에서만 추가.
- 확인: 운영에 018/019 이미 적용됨 (places 1095 / visits 458 / published 43).
- 관련 파일: admin/supabase/migrations/020_rls_hardening.sql, rollback/020_rls_hardening_down.sql, dev/prod_rls_state.sql, tests/rls-hardening.test.ts

## [2026-10-29] admin을 검토함 중심으로 재구성 (021·022)
- 결정: 수집기(odiga 사진 폴더·카카오·인스타)가 place_intake에 쌓고 운영자는 admin 검토함에서 가봤음/안 가봤지만 추천/나중에/제외만 고른다. 입력폼은 /places/[id] 수정 화면으로 대체.
- 결정: 새 테이블(places 등)이 기준. 사이트가 아직 locations/attractions를 읽으므로 022 트리거가 한 방향으로 옮겨 쓴다. 예전 상세(/locations/[id])는 /places로 리다이렉트.
- 사진: 사용자 결정으로 직접 찍음 > 가게 공식 > 웹 순, 출처(source, source_url) 저장.
- 확인: odiga 폴더 89곳·1,393장, DB 매칭 41곳(그중 10곳 후보로 잘못 표시), 새 장소 44곳, 이름 중복 4곳.
- 관련 파일: migrations/021·022, scripts/odiga-vault-intake.mjs, scripts/odiga-photo-upload.mjs, src/app/intake, src/app/places, src/lib/queries/{intake,places,review-needed}.ts
