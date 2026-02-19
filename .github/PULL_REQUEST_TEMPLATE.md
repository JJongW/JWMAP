## 요약
- 오늘오디가 리팩터링: 추천 응답에 LLM 큐레이션 층을 추가해 점수 기반 데이터를 스토리형 출력으로 전환
- CLI/응답 포맷을 브랜드형 서사형으로 개선 (추천 이유, 신뢰도, 요약/코스 스토리)
- PR 템플릿 기본 구조도 업데이트

## 작업 내용
- `odiga-api/lib/curation.ts` 신규 추가
  - 상위 N 장소/코스 + intent를 받아 `curated_summary`, `recommendation_reason`, `confidence` 생성
  - `curateWithLLM()` 샘플 구현
- `odiga-api/api/recommend.ts`
  - 추천 파이프라인에 `curateWithLLM()` 결합
  - 기존 점수 기반 응답을 브랜드형 응답(`BrandedRecommendResponse`)으로 변환
- `odiga-api/lib/intent.ts`
  - intent 확장: `noise_preference`, `budget_sensitivity`, `walking_preference` 지원
- `odiga-api/api/save-course.ts`
  - payload 정규화 보강, 코스 저장 유효성 안정화
- `odiga/src/index.ts`, `odiga/src/ui/types.ts`, `odiga/src/ui/renderer.ts`, `odiga/src/ui/prompts.ts`
  - 브랜드형 응답 소비 UI(요약/신뢰도/추천 이유/코스 스토리/감정 플로우) 반영
- `odiga-api/lib/curation.test.ts` 추가
  - LLM 미사용 폴백 동작 테스트
- `.github/PULL_REQUEST_TEMPLATE.md`
  - PR 템플릿 추가/정제

## 테스트
- [x] `npm --prefix odiga-api run test` (새 테스트 포함) ✅
- [x] `npm --prefix odiga run build` ✅

## 체크리스트
- [x] 타입 체크 및 빌드 통과
- [x] 변경 사항에 대한 테스트 추가/수정
- [x] 회귀 영향 검토(관련 기능)
- [ ] 필요 시 문서/템플릿 업데이트 (본 PR에서 템플릿 반영 완료)

## 이슈/추적
- 내부: odiga 리팩터링 미반영 상태 정리 및 신규 큐레이션 로직 반영
