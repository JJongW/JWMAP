# agent-server: Claude가 Oomap 운영을 직접 다루기 (설계)

작성 2026-10-29 · 상태: 설계 (구현 전)

## 왜 필요한가

지금 Oomap 운영은 두 갈래다.

- **admin 화면** (jwmap.vercel.app): 검토함, 장소 수정, 확인 필요. 사람이 클릭한다.
- **스크립트** (`admin/scripts/*.mjs`): 사진 폴더·카카오 즐겨찾기 수집, 카카오 점검, 사진 업로드. Mac mini에서 돈다.

Claude Code도 Mac mini에서 돌지만, 운영 DB에 쓰는 명령(`--apply`)은 권한 검사에서 막힌다. 그래서 매번 운영자가 `! node … --apply`를 직접 실행하고 있다. 막히는 게 맞다. 무엇이 바뀌는지 운영자가 보지 않고 운영 DB가 바뀌면 안 된다.

목표: **Claude가 읽기·초안·드라이런은 혼자 하고, 운영 DB 쓰기는 운영자가 한 번 승인하면 실행한다.** 승인과 실행 기록은 jmw-auto-engine에 이미 있는 장치를 쓴다.

## 구조

```
Claude Code (Mac mini)
   │  stdio (MCP)
   ▼
oomap MCP 서버  ── jmw-auto-engine/src/mcp/  (같은 저장소, 같은 .env)
   │  읽기: Supabase anon/service (서버 안에서만)
   │  쓰기: agent_tasks 생성 → 승인 → executionEngine.run → execution_logs
   ▼
Supabase (운영)          admin 화면 (같은 데이터를 사람이 본다)
```

- MCP 서버는 Mac mini에서 Claude Code가 띄우는 로컬 프로세스다 (`.mcp.json`의 stdio). 네트워크에 열지 않는다.
- service role 키는 MCP 서버 환경변수에만 있다. Claude는 키 값을 보지 않는다.
- 쓰기 작업은 jmw-auto-engine의 `agent_tasks`로 만든다. `src/approval/approvalGate.ts`의 `assertApproved`를 통과해야 `src/executor/executionEngine.ts`가 실행하고, 결과는 `execution_logs`에 남는다. 이미 콘텐츠 엔진이 같은 흐름을 쓰고 있다.
- 실제 일은 지금 스크립트가 하는 것과 같아야 한다. 스크립트의 핵심(`admin/scripts/lib/kakao.mjs`, 각 스크립트의 계산 부분)을 함수로 빼서 스크립트와 MCP가 함께 쓴다. 같은 일을 두 벌로 만들지 않는다.

## 도구 (tools)

### 읽기: 승인 없이 바로

| 도구 | 하는 일 |
|---|---|
| `intake_list(status, source?, folder?, limit)` | 검토함 목록 (admin 검토함과 같은 필터) |
| `place_get(id)` | 장소 하나의 방문·추천·분류·사진·참고 정보 |
| `review_needed(kind)` | 확인 필요 탭 목록 (폐업 의심, 추천 이유 없음 …) |
| `kakao_check(ids?)` | 카카오 점검 드라이런 (`kakao-place-check` 계산 부분) |
| `saved_folders(link)` | 카카오 즐겨찾기 폴더·장소 수 (드라이런) |

### 쓰기: 드라이런 → 승인 → 실행

모든 쓰기 도구는 두 단계다.

1. `*_plan`이 바뀔 내용을 계산해 `agent_tasks`(status `pending`)에 저장하고, 요약(몇 곳, 무엇이 어떻게)을 돌려준다.
2. 운영자가 승인하면 `task_run(task_id)`이 실행한다. 승인 전이면 `ApprovalGateError`.

| 계획 도구 | 실행되면 |
|---|---|
| `intake_decide_plan(items: [{id, status, place_id?, basis?}])` | `admin_decide_intake` 호출 (검토함 결정 여러 개 한 번에) |
| `recommendation_plan(place_id, body, basis, publish)` | 추천 문장 초안 저장 또는 공개 |
| `places_hide_plan(ids, reason)` | 폐업 확인한 곳 숨김 (`visit_status = hidden`) |
| `collect_apply_plan(source)` | 사진 폴더·카카오 즐겨찾기·카카오 점검 결과를 운영 DB에 반영 |
| `photos_upload_plan(limit)` | 내 사진 업로드 (Cloudinary) |

**승인하는 방법** (둘 중 하나)
- admin 화면 "승인 대기" 목록에서 승인. 콘텐츠 엔진 승인 화면을 장소 작업에도 쓴다.
- Claude Code 대화에서 운영자가 "승인"이라고 답하면, Claude가 `task_approve(task_id)`를 부른다. 이 도구는 Claude Code 권한 설정에서 매번 확인을 받게 둔다 (`permissions.ask`).

**한 번에 바꿀 수 있는 양에 상한을 둔다.** 숨김은 50곳, 검토함 결정은 200곳까지. 넘으면 나눠서 계획한다.

## 하지 않는 것

- 행 삭제 도구는 만들지 않는다. 숨김(`hidden`)과 상태 변경만 한다.
- 남의 목록 폴더(흑백요리사·카카오 동네맛집·우체국 추천)는 운영자가 따로 말하기 전에는 수집 대상에서 뺀다 (`kakao-saved-collect`의 기본 제외 폴더).
- 운영자 로그인(카카오 등)은 Claude가 대신하지 않는다. 공개 폴더처럼 로그인이 필요 없는 경로를 쓴다.

## 순서

1. 스크립트의 계산 부분을 함수로 빼기 (`admin/scripts/lib/`). 동작은 그대로, 지금 테스트로 확인.
2. jmw-auto-engine에 `src/mcp/server.ts`를 만들고 읽기 도구 5개를 붙인다. `@modelcontextprotocol/sdk`는 정확한 버전으로 고정한다.
3. `commandRegistry`에 장소 작업 명령을 등록하고, 계획/실행 도구와 승인 흐름을 붙인다.
4. admin "승인 대기"에 장소 작업을 보여준다.
5. JWMAP `.mcp.json`에 서버를 등록하고, Claude Code 권한에서 `task_approve`만 매번 확인으로 둔다.

## 확인 기준

- 읽기 도구 결과가 admin 화면과 같다.
- 승인 없이 `task_run`을 부르면 실패하고, 운영 DB는 그대로다.
- 실행하면 `execution_logs`에 무엇을 몇 건 바꿨는지 남는다.
- 같은 계획을 두 번 실행해도 결과가 같다 (스크립트들의 upsert·중복 방지를 그대로 쓴다).
