# 현재 계획서 — 2026-10-29

## 목표
오늘 오디가? DB 대규모 개편. 운영자가 직접 가본 곳과 운영자가 쓴 추천 이유가 중심인 DB로 재구성하고,
카카오맵 저장 장소·외부 사실 정보(네이버·Google·SNS)로 보강한다.

## 기준 문서 (반드시 먼저 읽기)
- `docs/db-overhaul/README.md` — 진단, 가드레일, 목표 모델, Phase 0~5, 결정 필요 사항
- `docs/db-overhaul/audit.mjs` — 읽기 전용 DB 감사 스크립트

## 실행 환경
macOS(Mac mini)의 Claude 에이전트 세션. 카카오맵 로그인은 사용자가 직접 한다.

## 지금 할 일
Phase 0 (읽기 전용): 레포 최신화 → DB 백업 → 감사 재측정 → 카카오맵 저장 장소 수집 → 기존 DB 대조 → 사용자 보고 후 멈춤.

## 완료 기준 (Phase 0)
- `data/kakao-saved/kakao_saved_items.json` 생성 (git 제외)
- `docs/db-overhaul/audit-YYYY-MM-DD.md`, `docs/db-overhaul/kakao-diff.md` 작성
- 사용자에게 분류별 개수 + README 6장 결정 사항 보고

## 이전 작업
- oomap.kr 첫 경험 개선 6개 항목: 이슈 #59, PR #60 머지 완료 (2026-10-29)
