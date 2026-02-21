import { c } from './colors.js';
import type { Course, BrandedPlace } from '../api/types.js';
import { naverMapLink, kakaoMapLink } from '../utils/mapLink.js';

function getDifficultyLabel(difficulty: Course['difficulty']): string {
  switch (difficulty) {
    case '★☆☆': return '쉬움';
    case '★★☆': return '보통';
    case '★★★': return '도전';
  }
}

export function renderHeader(): void {
  console.log();
  console.log(c.title('  ┌───────────────────────┐'));
  console.log(c.title('  │     ') + c.highlight('오늘 오디가?') + c.title('      │'));
  console.log(c.title('  └───────────────────────┘'));
  console.log();
}

export function renderGuide(): void {
  console.log(c.dim('  코스 난이도: ★☆☆ ~800m  ★★☆ ~1.8km  ★★★ 1.8km+'));
  console.log();
}

// ── Single place recommendation ──

export function renderPlaceList(places: BrandedPlace[]): void {
  console.log(c.title(`  ${c.emoji.fire}  오늘오디가의 추천 3분 컷으로 확인`));
  console.log();

  for (const place of places) {
    renderPlaceSummary(place);
  }
}

function renderPlaceSummary(place: BrandedPlace): void {
  const placeName = place.place.name;
  const category = [place.place.category_main, place.place.category_sub].filter(Boolean).join(' > ');
  const rankLabel = `오늘오디가의 ${place.rank}순위`;

  console.log(c.highlight(`  ${rankLabel}: ${placeName}`) + (category ? c.dim(`  ${category}`) : ''));
  console.log(c.dim(`     ${place.recommendation_reason}`));
  console.log(`     ${c.emoji.pin} ${c.dim(place.place.address || place.place.region)}`);
  if (place.place.rating) {
    console.log(`     ${c.score(`${c.emoji.star} ${place.place.rating.toFixed(1)}`)}`);
  }
  console.log();
}

export function renderPlaceDetail(place: BrandedPlace): void {
  console.log();
  console.log(c.title(`  ═══ ${place.place.name} ═══`));
  console.log();

  if (place.place.short_desc) {
    console.log(`  ${place.place.short_desc}`);
    console.log();
  }

  const category = [place.place.category_main, place.place.category_sub].filter(Boolean).join(' > ');
  if (category) console.log(c.dim(`  ${category}`));
  console.log(c.dim(`  ${c.emoji.pin} ${place.place.address || place.place.region}`));
  if (place.place.rating) console.log(c.score(`  ${c.emoji.star} ${place.place.rating.toFixed(1)}`));

  console.log();
  console.log(c.warn(`  큐레이션 이유: ${place.recommendation_reason}`));

  if (place.place.memo) {
    console.log();
    console.log(c.dim(`  📝 ${place.place.memo}`));
  }

  if (place.place.tags && place.place.tags.length > 0) {
    console.log();
    console.log(c.dim(`  🏷️  ${place.place.tags.join(', ')}`));
  }

  console.log();
  console.log(c.link(`  ${c.emoji.map} 네이버: ${naverMapLink(place.place.name)}`));
  console.log(c.link(`  ${c.emoji.map} 카카오: ${kakaoMapLink(place.place.name)}`));
  console.log();
}

// ── Course recommendation ──

export function renderCourseList(courses: Course[]): void {
  renderGuide();
  console.log(c.title(`  ${c.emoji.course}  오디가가 만든 코스`));
  console.log();

  for (const course of courses) {
    renderCourseSummary(course);
  }
}

export function renderCourseSummary(course: Course): void {
  if (course.curation_text) {
    // Show header through "— 흐름 —" section only (steps shown in detail view)
    const lines = course.curation_text.split('\n');
    const summaryLines: string[] = [];
    for (const line of lines) {
      if (/^\[1\]/.test(line)) break;
      summaryLines.push(line);
    }
    while (summaryLines.length > 0 && summaryLines[summaryLines.length - 1].trim() === '') {
      summaryLines.pop();
    }
    for (const line of summaryLines) {
      console.log(`  ${line}`);
    }
    console.log();
    return;
  }

  const distKm = (course.totalDistance / 1000).toFixed(1);
  console.log(c.highlight(`  ── 코스 ${course.id} 스토리 ──`));
  console.log(`  ${c.distance(`${c.emoji.walk} ${distKm}km`)} ${course.difficulty} ${c.dim(getDifficultyLabel(course.difficulty))}`);
  console.log(c.dim(`  ${course.course_story}`));
  console.log(`  ${c.dim('이동 감각: ' + (course.mood_flow || []).join(' → '))}`);
  console.log();
}

export function renderCourseDetail(course: Course): void {
  console.log();

  if (course.curation_text) {
    for (const line of course.curation_text.split('\n')) {
      console.log(`  ${line}`);
    }
    console.log();
    console.log(c.dim('  — 지도 링크 —'));
    console.log();
    for (const step of course.places) {
      console.log(c.highlight(`  ${step.name}`));
      console.log(c.link(`    ${c.emoji.map} 네이버: ${naverMapLink(step.name)}`));
      console.log(c.link(`    ${c.emoji.map} 카카오: ${kakaoMapLink(step.name)}`));
      console.log();
    }
    return;
  }

  console.log(c.title(`  ═══ 코스 ${course.id} 상세 ═══`));
  console.log();

  console.log(c.highlight(`  감성 스토리`));
  console.log(c.dim(`  ${course.course_story}`));
  console.log();

  if (course.mood_flow.length > 0) {
    console.log(c.highlight(`  무드 플로우`));
    console.log(c.dim(`  ${course.mood_flow.join(' → ')}`));
    console.log();
  }

  console.log(c.highlight(`  추천 이유`));
  console.log(c.dim(`  ${course.recommendation_reason}`));
  console.log();

  console.log(c.highlight(`  루트`));
  console.log(c.dim(`  ${course.route_summary}`));
  console.log(c.dim(`  ${c.emoji.map} 최적 시간: ${course.ideal_time}`));
  console.log();

  for (const step of course.places) {
    console.log(c.step(`  [${step.vibe_hint}]`) + ' ' + c.highlight(step.name));
    console.log(c.dim(`    ${c.emoji.pin} ${step.region}`));
    console.log();
    console.log(c.link(`    ${c.emoji.map} 네이버: ${naverMapLink(step.name)}`));
    console.log(c.link(`    ${c.emoji.map} 카카오: ${kakaoMapLink(step.name)}`));
    console.log();
  }
}

// ── Common ──

export function renderStats(stats: import('../api/types.js').StatsResult): void {
  console.log();
  console.log(c.title(`  ${c.emoji.stats}  odiga 통계`));
  console.log();
  console.log(c.highlight(`  총 검색: ${stats.totalSearches}회`));
  console.log();

  if (stats.topRegions.length > 0) {
    console.log(c.subtitle('  인기 지역 TOP 5:'));
    for (const r of stats.topRegions) {
      const bar = '█'.repeat(Math.min(20, Math.round(r.count / stats.totalSearches * 20)));
      console.log(`    ${r.region.padEnd(10)} ${c.success(bar)} ${r.count}회`);
    }
    console.log();
  }

  if (stats.responseTypeDistribution.length > 0) {
    console.log(c.subtitle('  응답 타입:'));
    for (const r of stats.responseTypeDistribution) {
      const label = r.type === 'course' ? '코스' : '장소';
      console.log(`    ${label.padEnd(10)} ${r.count}회`);
    }
    console.log();
  }

  if (stats.modeDistribution.length > 0) {
    console.log(c.subtitle('  모드 분포:'));
    for (const m of stats.modeDistribution) {
      console.log(`    ${m.mode.padEnd(10)} ${m.count}회`);
    }
    console.log();
  }

  if (stats.topActivityTypes.length > 0) {
    console.log(c.subtitle('  인기 활동 TOP 5:'));
    for (const a of stats.topActivityTypes) {
      console.log(`    ${a.activity.padEnd(10)} ${a.count}회`);
    }
    console.log();
  }

  if (stats.topVibes.length > 0) {
    console.log(c.subtitle('  인기 분위기 TOP 10:'));
    for (const v of stats.topVibes) {
      console.log(`    ${v.vibe.padEnd(10)} ${v.count}회`);
    }
    console.log();
  }

  if (stats.topSelectedPlaces.length > 0) {
    console.log(c.subtitle('  가장 많이 선택된 장소:'));
    for (const p of stats.topSelectedPlaces) {
      console.log(`    ${p.name.padEnd(15)} ${p.count}회`);
    }
    console.log();
  }

  if (stats.seasonDistribution.length > 0) {
    console.log(c.subtitle('  시즌 분포:'));
    for (const s of stats.seasonDistribution) {
      console.log(`    ${s.season.padEnd(10)} ${s.count}회`);
    }
    console.log();
  }

  if (stats.hourDistribution.length > 0) {
    console.log(c.subtitle('  시간대별 검색:'));
    const maxCount = Math.max(...stats.hourDistribution.map((h) => h.count));
    for (const h of stats.hourDistribution) {
      const bar = '▓'.repeat(Math.min(15, Math.round(h.count / maxCount * 15)));
      console.log(`    ${String(h.hour).padStart(2, '0')}시 ${c.dim(bar)} ${h.count}회`);
    }
    console.log();
  }

  const { weekday, weekend } = stats.weekdayVsWeekend;
  if (weekday + weekend > 0) {
    console.log(c.subtitle('  평일 vs 주말:'));
    console.log(`    평일  ${weekday}회 (${((weekday / (weekday + weekend)) * 100).toFixed(0)}%)`);
    console.log(`    주말  ${weekend}회 (${((weekend / (weekday + weekend)) * 100).toFixed(0)}%)`);
    console.log();
  }

  console.log(c.subtitle('  기타 지표:'));
  console.log(`    파싱 오류율:     ${(stats.parseErrorRate * 100).toFixed(1)}%`);
  console.log(`    평균 재추천 횟수: ${stats.avgRegenerateCount.toFixed(1)}회`);
  if (stats.avgWalkingDistance > 0) {
    console.log(`    평균 도보 거리:  ${(stats.avgWalkingDistance / 1000).toFixed(1)}km`);
  }
  console.log();
}

export function renderNoResults(): void {
  console.log();
  console.log(c.warn(`  ${c.emoji.warn}  조건에 맞는 장소를 찾지 못했어요.`));
  console.log(c.dim('     다른 지역이나 키워드로 검색해보세요.'));
  console.log();
}

export function renderSaved(hash: string): void {
  console.log(c.success(`  ${c.emoji.save}  저장 완료! (${hash})`));
  console.log();
}
