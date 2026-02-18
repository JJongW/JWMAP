import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('비로그인 상태에서 /login으로 리다이렉트된다', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('로그인 페이지가 렌더링된다', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
  });
});
