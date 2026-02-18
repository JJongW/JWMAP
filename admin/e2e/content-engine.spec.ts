import { test, expect } from '@playwright/test';

test.describe('Content Engine', () => {
  test.skip(!process.env.E2E_AUTH_COOKIE, 'E2E_AUTH_COOKIE 필요');

  test.beforeEach(async ({ page }) => {
    const cookie = process.env.E2E_AUTH_COOKIE;
    if (cookie) {
      await page.context().addCookies([
        {
          name: 'sb-access-token',
          value: cookie,
          domain: 'localhost',
          path: '/',
        },
      ]);
    }
  });

  test('콘텐츠 엔진 페이지가 로드된다', async ({ page }) => {
    await page.goto('/content-engine');
    await expect(page.locator('body')).toBeVisible();
  });

  test('초안 목록 페이지가 로드된다', async ({ page }) => {
    await page.goto('/content-engine/drafts');
    await expect(page.locator('body')).toBeVisible();
  });

  test('트렌드 리포트 페이지가 로드된다', async ({ page }) => {
    await page.goto('/content-engine/trends');
    await expect(page.locator('body')).toBeVisible();
  });
});
