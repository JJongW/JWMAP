import { test, expect } from '@playwright/test';

test.describe('Locations', () => {
  // 인증이 필요한 테스트 — 환경변수 없으면 skip
  test.skip(!process.env.E2E_AUTH_COOKIE, 'E2E_AUTH_COOKIE 필요');

  test.beforeEach(async ({ page }) => {
    // Supabase auth cookie 설정
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

  test('장소 목록 페이지가 로드된다', async ({ page }) => {
    await page.goto('/locations');
    await expect(page.locator('body')).toBeVisible();
    // 테이블 또는 목록 컴포넌트가 존재하는지 확인
    await expect(page.locator('table, [role="table"], [data-testid="locations-list"]')).toBeVisible({ timeout: 10000 });
  });

  test('장소 상세 페이지로 이동할 수 있다', async ({ page }) => {
    await page.goto('/locations');
    const firstRow = page.locator('table tbody tr, [role="row"]').first();
    await firstRow.click();
    await expect(page).toHaveURL(/\/locations\/[\w-]+/);
  });
});
