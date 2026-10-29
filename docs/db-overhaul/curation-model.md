# 큐레이션 모델 (018/019) — 이관 기준

> 2026-10-29 · 개발 DB(PGlite)에서만 적용·검증. **운영 DB 미반영.**
> 결과 수치: `curation-dryrun-2026-10-29.json` (운영 데이터 읽기 전용 복사본으로 드라이런)

## 원칙
- 기존 `locations` / `attractions` / `tags` / `location_tags` / `attraction_tags` 는 읽기만 한다 (드라이런에서 전후 지문 동일 확인).
- 새 테이블만 추가한다. `places.id` = 원본 id. 사진·카카오/네이버 id 그대로.
- 원문(`short_desc`, `memo`)은 `source_notes.raw_text` 에 손대지 않고 복사.
- 태그·문장에서 뽑은 이유·상황은 `suggested`. 운영자가 고른 기존 분류(category)만 `confirmed`.
- 근거가 없으면 붙이지 않고 `curation_review_*` 뷰에 미분류로 남긴다.
- 019는 여러 번 돌려도 결과가 같다.

## 매핑표
| 기존 | 새 위치 | 변환 | 상태 |
|---|---|---|---|
| locations/attractions.id, name, address, lat/lon, region, sub_region, province | places.* | 그대로 | 자동 |
| kakao_place_id, naver_place_id, imageUrl | places.kakao_place_id, naver_place_id, image_url | 그대로 | 자동 |
| price_level | places.price_level | 1~4만, 그 외 NULL (원본 유지) | 자동 |
| curator_visited | places.visit_status (visited/candidate) + visits 1건 | true만 방문 기록 | 자동 |
| visit_date | visits.visited_on (+precision=day) | 없으면 unknown | 자동 |
| short_desc | source_notes(origin=short_desc) | 원문 보존 + 분류(address/operator_note) | 자동 |
| short_desc (운영자 글) | recommendations.body | 방문한 곳 published, 미방문 draft | 자동, **draft 검토 필요** |
| memo | source_notes(origin=memo) | auto_generated / unknown | 자동, **unknown 검토 필요** |
| category_main/sub | place_terms(place_type, confirmed) | 사전의 legacy_categories | 자동 |
| tags / location_tags / attraction_tags | place_terms(place_type·reason·situation, suggested) | 사전의 legacy_tags (공백 무시) | 제안만 |
| 주차·예약·포장·배달·반려견·이동약자·노키즈·무료 태그 | place_facts (unverified, checked_at NULL) | legacy_tag_fact_map | 자동, **확인 필요** |
| 운영자 문장 속 말 (커피·노트북·평일 …) | recommendation_terms (rule, suggested) | 사전의 text_hints | 제안만 |
| curation_level, rating, event_tags, popularity | (옮기지 않음) | 기존 컬럼에 그대로 | 유지 |

## 수동 검토 (검토 뷰)
- `curation_review_untyped_places` — 장소 종류를 못 정한 곳
- `curation_review_unmapped_tags` — 어느 분류에도 안 들어간 기존 태그
- `curation_review_duplicates` — 카카오 id / 이름+주소 중복 (삭제하지 않음)
- `curation_review_fact_conflicts` — 같은 시설 정보가 서로 다른 값

## 실행 순서 (운영 반영 시, 승인 후)
1. 운영 DB 백업 (`pg_dump` 또는 Supabase 백업) — TODO Phase 2 항목
2. 스테이징(Supabase 브랜치)에 018 → 019 적용, `node admin/scripts/curation-dryrun.mjs` 와 수치 비교
3. 운영에 018 → 019 적용
4. 되돌리기: `admin/supabase/rollback/018_019_curation_model_down.sql` (새 테이블만 삭제)

## 검증
- `cd admin && npx vitest run supabase/tests` — 18개 (보존·멱등·RLS·되돌리기)
- `node admin/scripts/curation-dryrun.mjs` — 운영 데이터 읽기 전용 드라이런
