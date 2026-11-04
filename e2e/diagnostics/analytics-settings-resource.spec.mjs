import { test, expect } from '@playwright/test';
import { credentials, writeLocal } from '../helpers.mjs';
const evidence = { requestsFailed: [], consoleErrors: [], pageErrors: [], navigations: [] };
test.afterEach(() => writeLocal('analytics-settings-resource-evidence.json', evidence));
test('N07 diagnostic: unchanged 35 settings/inbox navigation sequence with network and renderer evidence', async ({ page }) => {
  page.on('requestfailed', request => evidence.requestsFailed.push({ path: new URL(request.url()).pathname, type: request.resourceType(), failure: request.failure()?.errorText }));
  page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text().replace(/Bearer\s+[^\s]+/g, 'Bearer [redacted]')); });
  page.on('pageerror', error => evidence.pageErrors.push(error.message));
  for (const [alias, role] of [['studentUi', 'candidate'], ['companyUi', 'recruiter']]) {
    const account = credentials()[alias];
    await page.goto('/login'); await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
    await page.locator('input[name="password"]').fill(account.password); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(`/${role}/dashboard`);
    for (const width of [375, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      for (const section of ['account', 'security', 'notifications']) {
        const route = `/${role}/settings/${section}`; await page.goto(route);
        evidence.navigations.push({ route, width, ...await page.evaluate(() => ({ htmlLength: document.documentElement.outerHTML.length, heap: performance.memory?.usedJSHeapSize })) });
        await expect(page.getByRole('heading', { name: role === 'candidate' ? 'Cài đặt ứng viên' : 'Cài đặt nhà tuyển dụng', exact: true })).toBeVisible();
        if (section === 'account') await expect(page.getByLabel(role === 'candidate' ? 'Họ tên' : 'Tên công ty', { exact: true })).toBeVisible();
        else if (section === 'security') await expect(page.getByLabel('Mật khẩu hiện tại', { exact: true })).toBeVisible();
        else await expect(page.getByRole('switch', { name: 'Thông báo hệ thống', exact: true })).toBeVisible();
      }
      if (role === 'candidate') { await page.goto('/candidate/notifications'); await expect(page.getByText('Không có thông báo phù hợp.', { exact: true })).toBeVisible(); }
    }
    await page.getByRole('button', { name: 'Menu tài khoản', exact: true }).click(); await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click(); await expect(page).toHaveURL('/login');
  }
  expect(evidence.pageErrors).toEqual([]);
});
