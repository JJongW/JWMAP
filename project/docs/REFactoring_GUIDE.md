# Project Refactoring Guide

## 문서 목적

- `project` 코드베이스를 운영 안정성을 유지한 상태에서 점진적으로 구조 개선하기 위한 기준 문서입니다.
- [로버트 마틴의 클린 코드 원칙], [마틴 파울러의 리팩토링 원칙]을 이 저장소 맥락에 맞게 실무 규칙으로 변환합니다.
- 기능 추가보다 "읽기 쉬운 코드", "변경 비용 감소", "회귀 방지"를 우선합니다.

## 적용 범위

- 프론트엔드: `src/**`
- 검색 API: `api/search.ts`
- 데이터 접근: `src/utils/supabase.ts`
- 대형 컴포넌트: `src/components/AddLocationModal.tsx`, `src/components/BrowseView.tsx`, `src/App.tsx`

## 핵심 원칙 요약

### 1) Clean Code (Robert C. Martin)

- **의미 있는 이름**: 변수/함수명만으로 목적이 드러나야 합니다.
- **작은 함수**: 한 함수는 한 가지 일만 하도록 분리합니다.
- **단일 책임**: 컴포넌트/모듈은 변경 이유가 하나여야 합니다.
- **중복 제거**: snake_case/camelCase 변환, 카테고리/지역 매핑 같은 반복 로직을 공통화합니다.
- **명확한 경계**: UI, 도메인 로직, 데이터 접근 계층을 분리합니다.
- **에러 처리 표준화**: 예외/실패 시 메시지/로그/리턴 형태를 일관화합니다.

### 2) Refactoring (Martin Fowler)

- **Extract Function**: 긴 함수 분리 (`searchLocations`, `searchWithFallback`)
- **Move Function**: 컴포넌트 내부 도우미를 유틸/서비스로 이동
- **Introduce Parameter Object**: 흩어진 필터 상태를 객체로 통합
- **Split Phase**: 검색 파이프라인을 단계별 함수로 분해
- **Encapsulate Mapping**: DB/App 매핑을 단일 매퍼로 캡슐화

## 저장소 특화 불변 규칙

- LLM은 장소 생성 금지, 쿼리 해석만 담당
- 검색 결과는 반드시 DB(`locations`) 기반
- 딥링크 UX는 사용자 클릭 이벤트 내부에서만 실행
- DB는 snake_case, 앱 내부는 camelCase 유지
- `VITE_` 환경변수 규약 유지

## 코드 스멜 -> 대응 리팩토링 매핑

| 스멜 | 현재 위치 | 대응 기법 |
|---|---|---|
| Long Function | `api/search.ts` | Extract Function, Split Phase |
| Large Component | `AddLocationModal.tsx`, `BrowseView.tsx`, `App.tsx` | Extract Component, Move Function |
| Data Clumps | `App.tsx` 필터 상태 | Introduce Parameter Object |
| 중복 매핑 로직 | `supabase.ts`, 여러 컴포넌트 | Encapsulate Mapping, Move Function |
| Shotgun Surgery | 카테고리/지역 변경 시 다수 파일 수정 | 공통 유틸/서비스 레이어 도입 |

## 모듈 경계 설계

- `src/utils/locationHelpers.ts`: 카테고리/지역 공통 계산 함수
- `src/utils/locationMapper.ts`: DB -> App, App -> DB 매핑
- `src/utils/categoryMapper.ts`: 외부 카테고리 -> 내부 카테고리 매핑
- `src/utils/regionMapper.ts`: 주소 -> 지역 추출
- `src/types/filter.ts`: 필터 상태 계약(Contract)

## 변경 정책 (허용/금지)

### 허용

- 함수 분리/이동/이름 개선
- 컴포넌트 분할 및 props 단순화
- 중복 로직 공통화
- 타입 구체화 (`any` 축소)

### 금지

- 핵심 UX 플로우 변경 (결정 -> 결과 -> 상세 -> 딥링크)
- LLM 역할 확장 (추천 생성/장소 생성)
- 사용자 클릭 없이 자동 딥링크 실행
- DB 스키마 의미를 깨는 임의 매핑

## 리팩토링 단계별 체크리스트

### Phase A: 공통화

- [x] 지역/카테고리 헬퍼 분리
- [x] DB/App 매퍼 도입
- [x] 기존 모듈 import 교체

### Phase B: 상태 구조 개선

- [x] `FilterState` 도입
- [x] 기존 개별 state 점진 대체
- [x] BrowseView props 그룹화

### Phase C: 검색 파이프라인 분해

- [x] Parse 단계 분리
- [x] Query 빌드 단계 분리
- [x] Filter/Fallback 분리
- [x] 응답 조립 단계 분리

### Phase D: 대형 컴포넌트 분해

- [x] `AddLocationModal` 섹션 컴포넌트 추출
- [x] `BrowseView` 제어 로직 분리
- [x] 공통 UI/도메인 함수 재사용화

## 현재 반영 구조 (2026-02)

- `api/search.ts`는 엔트리/오케스트레이션 중심으로 축소
- `api/searchParser.ts`: LLM 파싱 + 레거시 쿼리 변환
- `api/searchRepository.ts`: DB 조회/row 매핑
- `api/searchRanker.ts`: 키워드/제약 조건/정렬 규칙
- `api/searchFallback.ts`: 단계별 fallback 실행
- `api/searchPresentation.ts`: UI hint/actions 생성
- `api/searchLogging.ts`: search_logs 업데이트
- `src/hooks/useAddLocationForm.ts`: 장소 추가 폼 오케스트레이션
- `src/hooks/useGeocoding.ts`: 주소 좌표 변환 책임 분리
- `src/hooks/useTagSuggestions.ts`: AI 태그 제안 요청 책임 분리
- `src/components/add-location/*`: 장소추가 UI 섹션 컴포넌트 분리

## backend 제거 결정 (2026-02)

- `project/backend/*`는 MySQL + Express 레거시 서버였고, 현재 서비스 런타임 경로(`project/src`, `project/api`)에서 참조되지 않음을 확인했습니다.
- 데이터 접근은 Supabase 기반(`src/utils/supabase.ts`, `api/search*`)으로 통일되어 있어 중복 백엔드 유지 이점이 없다고 판단했습니다.
- 모노레포 루트 워크스페이스에서 `project/backend`를 제거해 `admin` + `project` 2개 패키지로 단순화했습니다.
- `project` 패키지에서 백엔드 전용 의존성(`mysql2`, `sharp`)도 함께 제거해 의존성 표면을 축소했습니다.

## 검증 기준

- `npm run build` 통과
- 변경 파일 ESLint 오류 0
- 핵심 수동 시나리오 점검:
  - 결정 플로우 진입/결과 노출
  - Browse 필터 적용/해제
  - 장소 상세 열기/딥링크 이동
  - 장소 추가 모달 저장
- 검색 API 응답 스키마 호환성 유지

## 완료 정의

- 대형 파일의 책임이 명확히 분리되어 변경 범위가 예측 가능해야 합니다.
- 매핑/헬퍼 로직이 한곳에서 관리되어 중복 수정이 줄어들어야 합니다.
- 신규 개발자가 문서만 읽고 구조와 변경 규칙을 이해할 수 있어야 합니다.
