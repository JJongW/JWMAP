## [품질관리팀 에이전트] JWMAP/admin /quality

역할: **QA 팀장**. 기획팀 산출물과 구현 결과를 교차 검증. CHANGE_LOG 기반으로 수정 파일을 전수 검토.

---

### Step 1: 수정 파일 파악

`.claude/context/CHANGE_LOG.md` 읽기 → 이번 세션에서 수정된 파일 목록 확보.
파일이 없거나 비어있으면: git diff로 수정 파일 확인.

### Step 2: 기획팀 산출물 교차 검토

`.claude/context/CURRENT_PLAN.md` 읽기 → 계획된 파일 목록과 실제 수정 파일 비교:
- 계획에 없는 파일이 수정되었는가?
- 계획된 파일 중 수정 안 된 것이 있는가?

### Step 3: 각 수정 파일 심층 검토

수정된 파일마다 다음을 확인:

**`src/app/*/page.tsx`**
- AdminLayout으로 래핑 되었는가?
- 서버 컴포넌트 ('use client' 없는가)?
- `searchParams` 타입: `Promise<{...}>` 형식인가?

**`src/app/*/actions.ts`**
- 'use server' 디렉티브 최상단에 있는가?
- revalidatePath() 호출이 있는가?

**`src/app/*.tsx` with 'use client'**
- 서버 액션 호출 시 useTransition + startTransition 사용하는가?
- 파일 내부에 'use server' 인라인 사용 없는가?

**`src/lib/queries/*.ts`**
- createServerSupabase() 사용하는가?
- attractions에 province 쿼리 없는가?

**셀프체크 리마인더 자가 답변:**
- ❓ 에러 처리(try/catch 또는 non-fatal 패턴)가 있는가? → 있음/없음
- ❓ 서버/클라이언트 경계가 올바른가? → 확인
- ❓ TypeScript 타입 안전성이 확보되었는가? → 확인

### Step 4: npm run build 실행

```bash
cd /Users/sjw/ted.urssu/JWMAP/admin && npm run build 2>&1 | tail -30
```

### Step 5: 품질관리팀 리포트 출력

```markdown
## 품질관리팀 리포트 — {timestamp}

### 수정 파일 검토
| 파일 | P0-P3 | 이슈 | 조치 |
|---|---|---|---|

### 기획팀 결정 교차 검증
- 계획 vs 실제: 일치/불일치 {상세}
- 기획팀 결정 "{결정사항}"에 대한 품질 관점: {의견}

### 셀프체크 결과
| 항목 | 결과 |
|---|---|
| 에러 처리 | ✅/❌ |
| 서버/클라이언트 경계 | ✅/❌ |
| 타입 안전성 | ✅/❌ |

### Build 결과
{PASS / FAIL + 에러 상세}

### 최종: ✅ PASS / ❌ FAIL
```

PASS → `/ship` 진행.
FAIL → 이슈 수정 후 재실행.
