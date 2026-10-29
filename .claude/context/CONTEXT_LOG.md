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
