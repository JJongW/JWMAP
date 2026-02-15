import { c } from './colors.js';
import type { Course } from '../engine/courseBuilder.js';
import type { ScoredPlace } from '../engine/scoring.js';
import type { StatsResult } from '../db/logs.js';
import { getDifficultyLabel } from '../engine/difficulty.js';
import { naverMapLink, kakaoMapLink } from '../utils/mapLink.js';

export function renderHeader(): void {
  console.log();
  console.log(c.title('  ┌─────────────────────────────────────┐'));
  console.log(c.title('  │     ') + c.highlight('오디가 odiga') + c.title('  ') + c.subtitle('오늘 어디가?') + c.title('      │'));
  console.log(c.title('  └─────────────────────────────────────┘'));
  console.log();
}

export function renderGuide(): void {
  console.log(c.dim('  코스 난이도: ★☆☆ ~800m  ★★☆ ~1.8km  ★★★ 1.8km+'));
  console.log(c.dim('  매칭 점수: 분위기·거리·인기·시즌 종합 (10점 만점)'));
  console.log();
}

// ── Single place recommendation ──

export function renderPlaceList(places: ScoredPlace[]): void {
  console.log(c.title(`  ${c.emoji.fire}  ${places.length}개 추천!\n`));

  for (let i = 0; i < places.length; i++) {
    renderPlaceSummary(places[i], i + 1);
  }
}

function renderPlaceSummary(place: ScoredPlace, rank: number): void {
  const scoreStr = (place.score * 10).toFixed(1);
  const category = [place.category_main, place.category_sub].filter(Boolean).join(' > ');

  console.log(c.highlight(`  ${rank}. ${place.name}`) + (category ? c.dim(`  ${category}`) : ''));

  if (place.short_desc) {
    console.log(c.dim(`     ${place.short_desc}`));
  }

  console.log(
    `     ${c.emoji.pin} ${c.dim(place.address || place.region)}` +
    (place.rating ? `  ${c.score(`${c.emoji.star} ${place.rating.toFixed(1)}`)}` : '') +
    `  ${c.dim(`매칭 ${scoreStr}점`)}`
  );
  console.log();
}

export function renderPlaceDetail(place: ScoredPlace): void {
  console.log();
  console.log(c.title(`  ═══ ${place.name} ═══`));
  console.log();

  if (place.short_desc) {
    console.log(`  ${place.short_desc}`);
    console.log();
  }

  const category = [place.category_main, place.category_sub].filter(Boolean).join(' > ');
  if (category) console.log(c.dim(`  ${category}`));
  console.log(c.dim(`  ${c.emoji.pin} ${place.address || place.region}`));
  if (place.rating) console.log(c.score(`  ${c.emoji.star} ${place.rating.toFixed(1)}`));

  if (place.memo) {
    console.log();
    console.log(c.dim(`  📝 ${place.memo}`));
  }

  if (place.tags && place.tags.length > 0) {
    console.log();
    console.log(c.dim(`  🏷️  ${place.tags.join(', ')}`));
  }

  console.log();
  console.log(c.link(`  ${c.emoji.map} 네이버: ${naverMapLink(place.name)}`));
  console.log(c.link(`  ${c.emoji.map} 카카오: ${kakaoMapLink(place.name)}`));
  console.log();
}

// ── Course recommendation ──

export function renderCourseList(courses: Course[]): void {
  renderGuide();
  console.log(c.title(`  ${c.emoji.course}  ${courses.length}개 코스를 찾았어요!\n`));

  for (const course of courses) {
    renderCourseSummary(course);
  }
}

export function renderCourseSummary(course: Course): void {
  const distKm = (course.totalDistance / 1000).toFixed(1);
  const diffLabel = getDifficultyLabel(course.difficulty);

  console.log(c.highlight(`  ── 코스 ${course.id} ──`));
  console.log(
    `  ${c.distance(`${c.emoji.walk} ${distKm}km`)}  ` +
    `${course.difficulty} ${c.dim(diffLabel)}  ` +
    `${c.score(`${c.emoji.star} ${(course.totalScore * 10).toFixed(1)}점`)}`
  );

  const route = course.steps.map((s) => s.place.name).join(' → ');
  console.log(c.dim(`  ${route}`));
  console.log();
}

export function renderCourseDetail(course: Course): void {
  console.log();
  console.log(c.title(`  ═══ 코스 ${course.id} 상세 ═══`));
  console.log();

  for (let i = 0; i < course.steps.length; i++) {
    const step = course.steps[i];
    const place = step.place;

    console.log(c.step(`  [${step.label}]`) + ' ' + c.highlight(place.name));

    if (place.short_desc) {
      console.log(c.dim(`    ${place.short_desc}`));
    }

    console.log(c.dim(`    ${c.emoji.pin} ${place.address || place.region}`));

    if (place.category_main) {
      console.log(c.dim(`    ${place.category_main}${place.category_sub ? ' > ' + place.category_sub : ''}`));
    }

    if (place.rating) {
      console.log(c.score(`    ${c.emoji.star} ${place.rating.toFixed(1)}`));
    }

    if (step.distanceFromPrev) {
      const distM = step.distanceFromPrev;
      const distStr = distM >= 1000 ? `${(distM / 1000).toFixed(1)}km` : `${distM}m`;
      const walkMin = Math.round(distM / 67);
      console.log(c.distance(`    ${c.emoji.walk} 이전에서 ${distStr} (도보 약 ${walkMin}분)`));
    }

    console.log(c.link(`    ${c.emoji.map} 네이버: ${naverMapLink(place.name)}`));
    console.log(c.link(`    ${c.emoji.map} 카카오: ${kakaoMapLink(place.name)}`));
    console.log();
  }

  const totalKm = (course.totalDistance / 1000).toFixed(1);
  const totalMin = Math.round(course.totalDistance / 67);
  console.log(c.highlight(`  총 거리: ${totalKm}km (도보 약 ${totalMin}분) | 난이도: ${course.difficulty}`));
  console.log();
}

// ── Common ──

export function renderStats(stats: StatsResult): void {
  console.log();
  console.log(c.title(`  ${c.emoji.stats}  odiga 통계`));
  console.log();
  console.log(c.highlight(`  총 검색: ${stats.totalSearches}회`));
  console.log();

  // 인기 지역
  if (stats.topRegions.length > 0) {
    console.log(c.subtitle('  인기 지역 TOP 5:'));
    for (const r of stats.topRegions) {
      const bar = '█'.repeat(Math.min(20, Math.round(r.count / stats.totalSearches * 20)));
      console.log(`    ${r.region.padEnd(10)} ${c.success(bar)} ${r.count}회`);
    }
    console.log();
  }

  // 응답 타입 분포
  if (stats.responseTypeDistribution.length > 0) {
    console.log(c.subtitle('  응답 타입:'));
    for (const r of stats.responseTypeDistribution) {
      const label = r.type === 'course' ? '코스' : '장소';
      console.log(`    ${label.padEnd(10)} ${r.count}회`);
    }
    console.log();
  }

  // 모드 분포
  if (stats.modeDistribution.length > 0) {
    console.log(c.subtitle('  모드 분포:'));
    for (const m of stats.modeDistribution) {
      console.log(`    ${m.mode.padEnd(10)} ${m.count}회`);
    }
    console.log();
  }

  // 인기 활동 타입
  if (stats.topActivityTypes.length > 0) {
    console.log(c.subtitle('  인기 활동 TOP 5:'));
    for (const a of stats.topActivityTypes) {
      console.log(`    ${a.activity.padEnd(10)} ${a.count}회`);
    }
    console.log();
  }

  // 인기 분위기
  if (stats.topVibes.length > 0) {
    console.log(c.subtitle('  인기 분위기 TOP 10:'));
    for (const v of stats.topVibes) {
      console.log(`    ${v.vibe.padEnd(10)} ${v.count}회`);
    }
    console.log();
  }

  // 인기 선택 장소
  if (stats.topSelectedPlaces.length > 0) {
    console.log(c.subtitle('  가장 많이 선택된 장소:'));
    for (const p of stats.topSelectedPlaces) {
      console.log(`    ${p.name.padEnd(15)} ${p.count}회`);
    }
    console.log();
  }

  // 시즌 분포
  if (stats.seasonDistribution.length > 0) {
    console.log(c.subtitle('  시즌 분포:'));
    for (const s of stats.seasonDistribution) {
      console.log(`    ${s.season.padEnd(10)} ${s.count}회`);
    }
    console.log();
  }

  // 시간대 분포
  if (stats.hourDistribution.length > 0) {
    console.log(c.subtitle('  시간대별 검색:'));
    const maxCount = Math.max(...stats.hourDistribution.map((h) => h.count));
    for (const h of stats.hourDistribution) {
      const bar = '▓'.repeat(Math.min(15, Math.round(h.count / maxCount * 15)));
      console.log(`    ${String(h.hour).padStart(2, '0')}시 ${c.dim(bar)} ${h.count}회`);
    }
    console.log();
  }

  // 평일/주말
  const { weekday, weekend } = stats.weekdayVsWeekend;
  if (weekday + weekend > 0) {
    console.log(c.subtitle('  평일 vs 주말:'));
    console.log(`    평일  ${weekday}회 (${((weekday / (weekday + weekend)) * 100).toFixed(0)}%)`);
    console.log(`    주말  ${weekend}회 (${((weekend / (weekday + weekend)) * 100).toFixed(0)}%)`);
    console.log();
  }

  // 기타 지표
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
