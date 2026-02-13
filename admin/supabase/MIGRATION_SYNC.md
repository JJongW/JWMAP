# Supabase CLI와 마이그레이션 동기화

로컬 마이그레이션 파일과 Supabase 원격 프로젝트를 CLI로 동기화하는 방법입니다.

## 1. 사전 준비

- [Supabase CLI 설치](https://supabase.com/docs/guides/cli/getting-started)
- Supabase 대시보드 [Access Token](https://supabase.com/dashboard/account/tokens) 발급

## 2. 초기 설정 (최초 1회)

```bash
cd admin

# Supabase CLI 로그인
supabase login

# config.toml이 없다면 초기화 (이미 migrations 폴더가 있어도 실행 가능)
supabase init

# 원격 프로젝트 연결 (project-ref는 대시보드 URL에서 확인)
# https://supabase.com/dashboard/project/<project-ref>
supabase link --project-ref fmfqafyffyxuzoagqcwr
```

프롬프트가 뜨면 **데이터베이스 비밀번호**를 입력합니다. (Supabase 대시보드 → Settings → Database)

## 3. 동기화 명령어

### 로컬 → 원격: 마이그레이션 적용 (Push)

```bash
cd admin
supabase db push
```

### 동기화 상태 확인

```bash
supabase migration list
```

| LOCAL | REMOTE | 의미 |
|-------|--------|------|
| ✓ | ✓ | 정상 동기화됨 |
| ✓ | - | 로컬에만 있음 → `db push`로 적용 필요 |
| - | ✓ | 원격에만 있음 → `db pull`로 가져오기 |

### 원격 → 로컬: 대시보드에서 변경한 스키마 가져오기

```bash
supabase db pull [마이그레이션_이름]
```

원격 DB 스키마를 기반으로 새 마이그레이션 파일이 생성됩니다.

### 적용 전 미리보기 (Dry Run)

```bash
supabase db push --dry-run
```

## 4. 마이그레이션 히스토리 불일치 시

로컬과 원격 히스토리가 어긋난 경우:

```bash
# 현재 상태 확인
supabase migration list

# 원격 히스토리 수동 수정 (예: 특정 버전을 "적용됨"으로 표시)
supabase migration repair <version> --status applied

# 또는 "되돌림"으로 표시
supabase migration repair <version> --status reverted
```

## 5. Project Ref 확인

Supabase 대시보드 URL 또는 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`에서 확인:

```
https://fmfqafyffyxuzoagqcwr.supabase.co
                  ↑
            project-ref
```
