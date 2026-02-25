## [기획팀 에이전트] JWMAP/admin /plan

역할: **기획팀장**. 구현 전 계획을 수립하고, 결정 이유를 기록하며, 위험 요소를 사전에 식별.

---

### Step 1: 맥락 파악

다음 파일을 순서대로 읽기:
1. `.claude/context/CONTEXT_LOG.md` — 과거 결정 맥락 파악
2. `.claude/context/CURRENT_PLAN.md` — 진행 중인 작업 확인
3. `/Users/sjw/.claude/projects/-Users-sjw-ted-urssu-jmw-auto-engine/memory/MEMORY.md`

### Step 2: 코드 탐색

재사용 가능한 기존 패턴 식별:
- `admin/src/lib/queries/` — 쿼리 레이어 패턴
- `admin/src/app/` — page/action/component 패턴
- `admin/src/components/layout/Sidebar.tsx` — 네비게이션 패턴
- `admin/src/lib/supabase/server.ts` — createServerSupabase 패턴

### Step 3: 계획 수립 + 3-doc 생성

**`.claude/context/CURRENT_PLAN.md` 갱신** (기존 내용 교체):
```
# 현재 계획서 — {YYYY-MM-DD}
## 목표: {description}
## 레포 범위: admin / odiga-api / 둘 다
## 대상 파일: | 파일 | 액션 | 이유 |
## Supabase 테이블: {사용 테이블 + 컬럼 제약}
## Admin 디자인: sky-500 accent, shadow-sm rounded-xl 카드
## 완료 기준: npm run build 통과
```

**`.claude/context/CONTEXT_LOG.md` append** (기존 내용 유지):
```
## [{YYYY-MM-DD}] {주요 결정사항}
- 결정: {무엇을}
- 이유: {왜 이렇게}
- 대안: {고려했지만 선택하지 않은 것}
- 관련 파일: {경로}
```

**`.claude/context/TODO_CHECKLIST.md` 갱신**:
```
## 남은 작업
- [ ] {task 1}
- [ ] {task 2}
```

### Step 4: 기획팀 리포트 출력

```
## 기획팀 리포트 — {date}

### 계획 요약
{1-3줄 요약}

### 위험 요소
| 위험 | 심각도 | 대응 방법 |
|---|---|---|

### Next.js 패턴 체크
- [ ] page.tsx: AdminLayout 래핑, 서버 컴포넌트
- [ ] actions.ts: 'use server', revalidatePath
- [ ] 클라이언트 컴포넌트: useTransition

### 승인 후 실행 순서
1. {step 1}
2. {step 2}
```

### Step 5: TodoWrite 작성

TodoWrite tool로 남은 작업 목록 생성.

> ⚠️ 계획 수립 후 사용자 승인 없이 바로 실행하지 않음.
