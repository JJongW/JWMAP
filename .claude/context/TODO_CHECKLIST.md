# 할일 체크리스트 (TODO_CHECKLIST.md)

> 끝낸 작업과 남은 작업을 추적합니다.
> /plan 실행 시 자동 갱신, 작업 중 Claude가 직접 체크합니다.

---

## 진행 중인 작업

- 큐레이션 모델 (docs/db-overhaul/curation-model.md)
  - [x] 018 스키마 · 019 이관 · 되돌리기 SQL
  - [x] 개발 DB(PGlite) 테스트 18개 + 운영 데이터 읽기 전용 드라이런
  - [x] 화면 문구·자연어 검색(장소 종류·이유·상황)
  - [ ] 운영자 검토: draft 추천 147, memo unknown 88, 미분류 장소 36, 미분류 태그, 중복 6쌍, 시설 충돌 1
  - [ ] 승인 후: 백업 → 스테이징 적용 → 운영 적용
  - [ ] 화면을 places/recommendations 로 전환 (운영 반영 후)
  - [x] admin 폼·추천 강도·목록 문구, 빠른 입력/코스 빌더가 추천하는 이유를 덮어쓰지 않게
  - [ ] 결정: 코스 빌더 새 장소 curator_visited=true 유지?
  - [ ] 검토: Claude ↔ Tailscale ↔ Mac mini 관리 서버(MCP) 설계

- oomap.kr 추천 신뢰도 정리 (CURRENT_PLAN.md)
  - [x] 1 조건 라벨·계산 일치 (볼거리), 결과 없음 안내
  - [x] 2 직접 방문/후보/추천 강도 구분
  - [x] 3 첫 화면 위계 (추천받기 주 행동)
  - [x] 4 추천 이유 근거만, 방문 정보 분리
  - [x] 5 1280×649 카드 가림·버튼 문구
  - [x] 테스트·lint·build + 화면 확인 (1280×649 데스크톱 헤드리스만)
  - [ ] 사용자 검토 후 커밋/PR (배포 보류 중)
  - [ ] 실제 iPhone Safari / Android Chrome 확인

_DB 대규모 개편 — Phase 0 대기 (macOS에서 실행). 기준: docs/db-overhaul/README.md_

## 완료된 작업

- [x] oomap.kr 첫 경험 개선 6개 항목 (#59, PR #60)
- [x] 현재 DB 진단 + 개편 계획 문서 작성 (docs/db-overhaul/)

## 남은 작업

### Phase 0 — 지금 당장 (macOS, 읽기 전용)
- [x] 0-1 Mac mini 레포 최신화, project/.env 준비, `npm test`(project) 통과 확인
- [ ] 0-2 운영 DB 백업 → **Phase 2(첫 운영 DB 쓰기) 직전으로 연기** (2026-10-29 사용자 결정)
- [x] 0-3 `node docs/db-overhaul/audit.mjs` 로 감사 재측정 → audit-YYYY-MM-DD.md
- [ ] 0-4 사용자 카카오맵 로그인 → 모든 즐겨찾기 폴더 장소 수집 → data/kakao-saved/ (git 제외)
- [ ] 0-5 기존 DB와 대조 → kakao-diff.md (4개 분류)
- [ ] Phase 0 보고 + README 6장 결정 요청 (여기서 멈춤)

### 이후 (각 단계 승인 필요)
- [ ] Phase 1 스키마 확정 (새 테이블만, 스테이징 먼저)
- [ ] Phase 2 시작 전 운영 DB 백업 (0-2에서 이동)
- [ ] Phase 2 원장 채우기·이관·카테고리 정리
- [ ] Phase 3 외부 사실 정보 보강 (공식 API, 출처 필수)
- [ ] Phase 4 운영자 작성 시트·초안 → 운영자 승인
- [ ] Phase 5 화면 전환 + 브랜드 정리 (오늘 오디가?, 해요체, 주황 대비)

## RLS (020)
- [x] 020 마이그레이션 + 되돌리기 + 개발 DB 테스트 12개
- [ ] (사용자) auth.users 확인 → 신규 가입 끄기 → SQL Editor에서 020 실행 → 사이트·admin 확인 → Advisor 재검사
- [ ] user_place_states 세션별 제한 (클라이언트 변경 필요, 경고 남음)

## 검토함 · admin 재구성
- [x] 021 (사용자 적용 완료) / 022 작성 + 테스트 53개
- [x] 검토함·장소 수정·확인 필요·메뉴·목록 화면, admin build 통과
- [ ] (사용자) 022 SQL Editor 실행 → odiga-vault-intake --apply → odiga-photo-upload --apply
- [ ] admin 배포 (022 적용 뒤)
- [ ] 카카오 저장 목록·리뷰·공식 사진 수집기 (브라우저 확인 필요)
- [ ] 사이트를 새 테이블로 전환 (hidden 상태는 그때부터 반영)
