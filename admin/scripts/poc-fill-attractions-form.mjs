import { chromium } from 'playwright';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3000';
const TARGET_URL = `${ADMIN_URL.replace(/\/$/, '')}/attractions/new`;
const HEADLESS = process.env.HEADLESS === 'true';
const KEEP_OPEN_MS = Number(process.env.KEEP_OPEN_MS || 5000);
const USE_SYSTEM_CHROME = process.env.PW_USE_SYSTEM_CHROME !== 'false';

const SAMPLE = {
  name: '국립현대미술관 서울관',
  region: '종로/중구',
  shortDesc: '서울 도심에서 전시를 밀도 있게 볼 수 있는 대표 미술관',
  memo: '주말 오후 혼잡도가 높아 평일 방문 추천',
  categoryMain: ['전시/문화', '문화/전시', '문화공간'],
  categorySub: ['미술관', '박물관', '전시관'],
  features: ['실내', '포토스팟', '조용한 분위기'],
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fillInput(page, selector, value) {
  const field = page.locator(selector).first();
  await field.waitFor({ state: 'visible', timeout: 5000 });
  await field.fill(value);
}

async function selectComboboxByIndex(page, index, preferredOptions, label) {
  const trigger = page.locator('button[role="combobox"]').nth(index);
  await trigger.waitFor({ state: 'visible', timeout: 5000 });
  await trigger.click();
  await page.waitForTimeout(150);

  for (const option of preferredOptions) {
    const optionLocator = page
      .locator('[role="option"]')
      .filter({ hasText: new RegExp(`^${escapeRegExp(option)}$`) })
      .first();

    if ((await optionLocator.count()) > 0) {
      await optionLocator.click();
      return option;
    }
  }

  const firstOption = page.locator('[role="option"]').first();
  if ((await firstOption.count()) > 0) {
    const fallbackText = (await firstOption.textContent())?.trim() || '(unknown)';
    await firstOption.click();
    return fallbackText;
  }

  throw new Error(`콤보박스 옵션을 찾지 못했습니다: ${label}`);
}

async function toggleFeatureBadge(page, label) {
  const badge = page.locator('[data-slot="badge"]').filter({ hasText: label }).first();
  if ((await badge.count()) === 0) {
    return false;
  }
  await badge.click();
  return true;
}

async function run() {
  let browser;
  try {
    browser = await chromium.launch(
      USE_SYSTEM_CHROME ? { headless: HEADLESS, channel: 'chrome' } : { headless: HEADLESS },
    );
  } catch (primaryError) {
    if (!USE_SYSTEM_CHROME) {
      throw primaryError;
    }
    console.warn('- 시스템 Chrome 실행 실패, Playwright 기본 Chromium으로 재시도합니다.');
    browser = await chromium.launch({ headless: HEADLESS });
  }
  const page = await browser.newPage();

  try {
    console.log(`- 페이지 이동: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await fillInput(page, 'input[name="name"]', SAMPLE.name);
    await fillInput(page, 'input[name="region"]', SAMPLE.region);
    await fillInput(page, 'input[name="short_desc"]', SAMPLE.shortDesc);
    await fillInput(page, 'textarea[name="memo"]', SAMPLE.memo);

    const selectedMain = await selectComboboxByIndex(page, 0, SAMPLE.categoryMain, '카테고리 대분류');
    await page.waitForTimeout(200);
    const selectedSub = await selectComboboxByIndex(page, 1, SAMPLE.categorySub, '카테고리 소분류');

    const featureResults = [];
    for (const feature of SAMPLE.features) {
      const toggled = await toggleFeatureBadge(page, feature);
      featureResults.push({ feature, toggled });
    }

    const current = {
      name: await page.locator('input[name="name"]').inputValue(),
      region: await page.locator('input[name="region"]').inputValue(),
      shortDesc: await page.locator('input[name="short_desc"]').inputValue(),
      memo: await page.locator('textarea[name="memo"]').inputValue(),
      // 셀렉트 컴포넌트 출력값 파싱 대신, 실제 클릭으로 확정된 옵션값을 사용한다.
      categoryMain: selectedMain,
      categorySub: selectedSub,
      features: featureResults,
    };

    console.log('\n[자동입력 결과]');
    console.log(`- 장소명: ${current.name}`);
    console.log(`- 지역: ${current.region}`);
    console.log(`- 한줄 설명: ${current.shortDesc}`);
    console.log(`- 메모: ${current.memo}`);
    console.log(`- 카테고리 대분류: ${String(current.categoryMain).trim()}`);
    console.log(`- 카테고리 소분류: ${String(current.categorySub).trim()}`);
    console.log(
      `- 특징 토글: ${current.features
        .map((entry) => `${entry.feature}(${entry.toggled ? '선택됨' : '미발견'})`)
        .join(', ')}`,
    );
    console.log('\n저장 버튼은 누르지 않았습니다.');

    if (KEEP_OPEN_MS > 0 && !HEADLESS) {
      await page.waitForTimeout(KEEP_OPEN_MS);
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('\n[실행 실패]', error);
  process.exit(1);
});
