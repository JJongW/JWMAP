import { test, expect } from '@playwright/test';

test.describe('Courses', () => {
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

  test('코스 관리 페이지가 로드된다', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.locator('body')).toBeVisible();
  });
});
