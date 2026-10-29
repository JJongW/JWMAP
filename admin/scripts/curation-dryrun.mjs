// 큐레이션 모델(018/019) 드라이런: 운영 데이터를 읽기만 해서(anon 키, GET) 로컬 메모리 DB(PGlite)에 복사하고
// 마이그레이션을 적용한 결과를 집계한다. 운영 DB에는 아무것도 쓰지 않는다.
// 사용법: node admin/scripts/curation-dryrun.mjs > docs/db-overhaul/curation-dryrun-YYYY-MM-DD.json
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sql = (relative) => readFileSync(join(root, 'admin', 'supabase', relative), 'utf8');
const env = Object.fromEntries(
  readFileSync(join(root, 'project', '.env'), 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` };
const fetchAll = async (table) => {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=*&limit=10000`, { headers });
  if (!res.ok) throw new Error(`${table} ${res.status}`);
  return res.json();
};

const db = new PGlite();
await db.exec(sql('dev/base_schema.sql'));
const source = {};
for (const table of ['locations', 'attractions', 'tags', 'location_tags', 'attraction_tags']) {
  source[table] = await fetchAll(table);
  await db.query(`INSERT INTO ${table} SELECT * FROM json_populate_recordset(NULL::${table}, $1)`, [JSON.stringify(source[table])]);
}

const q = async (text) => (await db.query(text)).rows;
const fingerprint = async () =>
  Object.fromEntries(await Promise.all(['locations', 'attractions', 'tags', 'location_tags', 'attraction_tags'].map(async (t) => [
    t, (await q(`SELECT count(*)::int || ':' || md5(string_agg(x::text, '|' ORDER BY x::text)) AS f FROM ${t} x`))[0].f,
  ])));

const before = await fingerprint();
await db.exec(sql('migrations/018_curation_model.sql'));
await db.exec(sql('migrations/019_backfill_curation_model.sql'));
const counts = async () => Object.fromEntries(await Promise.all(
  ['places', 'source_notes', 'visits', 'recommendations', 'recommendation_visits', 'place_terms', 'recommendation_terms', 'place_facts', 'taxonomy_terms']
    .map(async (t) => [t, (await q(`SELECT count(*)::int AS n FROM ${t}`))[0].n]),
));
const firstCounts = await counts();
await db.exec(sql('migrations/019_backfill_curation_model.sql'));
const secondCounts = await counts();
const after = await fingerprint();

const report = {
  generated_at: new Date().toISOString(),
  source_rows: Object.fromEntries(Object.entries(source).map(([k, v]) => [k, v.length])),
  legacy_unchanged: JSON.stringify(before) === JSON.stringify(after),
  idempotent: JSON.stringify(firstCounts) === JSON.stringify(secondCounts),
  table_counts: firstCounts,
  places: await q(`SELECT legacy_table, visit_status, count(*)::int AS n FROM places GROUP BY 1, 2 ORDER BY 1, 2`),
  places_with_image: (await q(`SELECT count(*)::int AS n FROM places WHERE image_url IS NOT NULL AND image_url <> ''`))[0].n,
  places_with_kakao_id: (await q(`SELECT count(*)::int AS n FROM places WHERE kakao_place_id IS NOT NULL AND kakao_place_id <> ''`))[0].n,
  source_notes: await q(`SELECT origin, classified_as, count(*)::int AS n FROM source_notes GROUP BY 1, 2 ORDER BY 1, 2`),
  visits: await q(`SELECT visited_on_precision, count(*)::int AS n FROM visits GROUP BY 1`),
  recommendations: await q(`SELECT status, count(*)::int AS n FROM recommendations GROUP BY 1`),
  place_terms: await q(`SELECT t.kind, pt.status, pt.source, count(*)::int AS n FROM place_terms pt JOIN taxonomy_terms t ON t.id = pt.term_id GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`),
  places_with: (await q(`SELECT
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM place_terms pt JOIN taxonomy_terms t ON t.id = pt.term_id WHERE pt.place_id = p.id AND t.kind = 'place_type'))::int AS place_type,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM place_terms pt JOIN taxonomy_terms t ON t.id = pt.term_id WHERE pt.place_id = p.id AND t.kind = 'place_type' AND pt.status = 'confirmed'))::int AS place_type_confirmed,
      count(*) FILTER (WHERE (SELECT count(*) FROM place_terms pt JOIN taxonomy_terms t ON t.id = pt.term_id WHERE pt.place_id = p.id AND t.kind = 'place_type') > 1)::int AS multiple_place_types,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM place_terms pt JOIN taxonomy_terms t ON t.id = pt.term_id WHERE pt.place_id = p.id AND t.kind = 'reason'))::int AS reason,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM place_terms pt JOIN taxonomy_terms t ON t.id = pt.term_id WHERE pt.place_id = p.id AND t.kind = 'situation'))::int AS situation
    FROM places p`))[0],
  term_usage: await q(`SELECT t.kind, t.label, count(pt.place_id)::int AS places, count(pt.place_id) FILTER (WHERE pt.status = 'confirmed')::int AS confirmed
    FROM taxonomy_terms t LEFT JOIN place_terms pt ON pt.term_id = t.id GROUP BY t.kind, t.label ORDER BY t.kind, places DESC`),
  recommendation_terms: await q(`SELECT t.kind, t.label, count(*)::int AS n FROM recommendation_terms rt JOIN taxonomy_terms t ON t.id = rt.term_id GROUP BY 1, 2 ORDER BY n DESC`),
  place_facts: await q(`SELECT field, value::text AS value, count(*)::int AS n FROM place_facts GROUP BY 1, 2 ORDER BY 1, 2`),
  fact_conflicts: (await q(`SELECT count(*)::int AS n FROM curation_review_fact_conflicts`))[0].n,
  untyped_places: {
    total: (await q(`SELECT count(*)::int AS n FROM curation_review_untyped_places`))[0].n,
    by_category: await q(`SELECT legacy_table, coalesce(category_main, '(없음)') || ' > ' || coalesce(category_sub, '(없음)') AS category, count(*)::int AS n
      FROM curation_review_untyped_places GROUP BY 1, 2 ORDER BY n DESC`),
  },
  unmapped_tags: {
    total: (await q(`SELECT count(*)::int AS n FROM curation_review_unmapped_tags`))[0].n,
    top: await q(`SELECT tag, place_count FROM curation_review_unmapped_tags ORDER BY place_count DESC, tag LIMIT 40`),
  },
  duplicates: await q(`SELECT d.matched_by, d.key, (SELECT array_agg(p.name) FROM places p WHERE p.id = ANY (d.place_ids)) AS names FROM curation_review_duplicates d`),
  samples: {
    published_recommendations: await q(`SELECT p.name, left(r.body, 60) AS body,
        (SELECT array_agg(t.label ORDER BY t.label) FROM recommendation_terms rt JOIN taxonomy_terms t ON t.id = rt.term_id WHERE rt.recommendation_id = r.id) AS suggested_terms
      FROM recommendations r JOIN places p ON p.id = r.place_id WHERE r.status = 'published' ORDER BY p.name LIMIT 8`),
    draft_recommendations: await q(`SELECT p.name, left(r.body, 60) AS body FROM recommendations r JOIN places p ON p.id = r.place_id WHERE r.status = 'draft' ORDER BY p.name LIMIT 5`),
    operator_memos: await q(`SELECT p.name, left(n.raw_text, 60) AS memo FROM source_notes n JOIN places p ON p.id = n.place_id
      WHERE n.origin = 'memo' AND n.classified_as = 'operator_note' ORDER BY p.name LIMIT 6`),
  },
};
console.log(JSON.stringify(report, null, 2));
await db.close();
