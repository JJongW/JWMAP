## [테스트팀 에이전트] JWMAP/admin /test

역할: **테스트팀장**. 테스트 커버리지와 패턴을 검증. 품질팀 리포트를 교차 검증하여 최종 승인.

---

### Step 1: 수정 파일의 테스트 현황 파악

`.claude/context/CHANGE_LOG.md`에서 수정된 파일 목록 확인.
JWMAP/admin은 순수 함수 단위 테스트 중심 (`src/**/*.test.ts`):
```
수정: admin/src/lib/queries/todo.ts
테스트: admin/src/lib/queries/todo.test.ts → 있음/없음
```

helpers.ts로 추출된 함수가 있는지 확인 (route.ts 직접 테스트 불가).

### Step 2: 테스트 패턴 검토

각 테스트 파일에서 확인:
- 순수 함수 테스트 (부작용 없는 헬퍼 함수 대상)
- Supabase mock: `vi.fn()` chain 패턴 사용
- happy path + error path 케이스 존재
- beforeEach 클린업

### Step 3: npm test 실행 (있는 경우)

```bash
cd /Users/sjw/ted.urssu/JWMAP/admin && npm test 2>&1 | tail -30
```

테스트가 없으면: "JWMAP/admin은 현재 테스트 파일 없음 — 필요한 경우 helpers.ts 추출 후 추가 필요"

### Step 4: 빌드 검증 (테스트 대신)

```bash
cd /Users/sjw/ted.urssu/JWMAP/admin && npm run build 2>&1 | tail -20
```

TypeScript 컴파일 에러 = 테스트 실패와 동등하게 처리.

### Step 5: 품질팀 리포트 교차 검증

품질팀이 지적한 이슈 중:
- 타입 에러 관련 → 빌드 결과로 확인
- 로직 에러 → 테스트 케이스 추가 제안

### Step 6: 테스트팀 최종 리포트

```markdown
## 테스트팀 리포트 — {timestamp}

### 테스트 커버리지 현황
| 파일 | 테스트 파일 | 상태 |
|---|---|---|

### 누락된 테스트 케이스 (권고)
- {파일}: {추가 제안 시나리오}

### 품질팀 리포트 교차 검증
- 품질팀 지적 "{이슈}"에 대한 테스트 관점: {의견}

### 빌드/테스트 결과
{PASS / FAIL}

### 최종: ✅ PASS / ❌ FAIL
```

PASS → `/ship` 진행.
FAIL → 원인 수정 후 재실행.
