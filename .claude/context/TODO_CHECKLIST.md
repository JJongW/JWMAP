# 할일 체크리스트 (TODO_CHECKLIST.md)

> 끝낸 작업과 남은 작업을 추적합니다.
> /plan 실행 시 자동 갱신, 작업 중 Claude가 직접 체크합니다.

---

## 진행 중인 작업

_DB 대규모 개편 — Phase 0 대기 (macOS에서 실행). 기준: docs/db-overhaul/README.md_

## 완료된 작업

- [x] oomap.kr 첫 경험 개선 6개 항목 (#59, PR #60)
- [x] 현재 DB 진단 + 개편 계획 문서 작성 (docs/db-overhaul/)

## 남은 작업

### Phase 0 — 지금 당장 (macOS, 읽기 전용)
- [ ] 0-1 Mac mini 레포 최신화, project/.env 준비, `npm test`(project) 통과 확인
- [ ] 0-2 운영 DB 백업 만들고 위치 보고
- [ ] 0-3 `node docs/db-overhaul/audit.mjs` 로 감사 재측정 → audit-YYYY-MM-DD.md
- [ ] 0-4 사용자 카카오맵 로그인 → 모든 즐겨찾기 폴더 장소 수집 → data/kakao-saved/ (git 제외)
- [ ] 0-5 기존 DB와 대조 → kakao-diff.md (4개 분류)
- [ ] Phase 0 보고 + README 6장 결정 요청 (여기서 멈춤)

### 이후 (각 단계 승인 필요)
- [ ] Phase 1 스키마 확정 (새 테이블만, 스테이징 먼저)
- [ ] Phase 2 원장 채우기·이관·카테고리 정리
- [ ] Phase 3 외부 사실 정보 보강 (공식 API, 출처 필수)
- [ ] Phase 4 운영자 작성 시트·초안 → 운영자 승인
- [ ] Phase 5 화면 전환 + 브랜드 정리 (오늘 오디가?, 해요체, 주황 대비)
