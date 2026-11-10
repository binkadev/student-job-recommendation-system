import { test, expect } from '@playwright/test';
import { credentials, login, ok, readLocal } from '../helpers.mjs';

const manifest = readLocal('manifest.json');

test('W1-A real-browser verification: Saved Searches route/CRUD/Apply Filter + CV V2 Analysis metadata + deterministic CV Review', async ({ page }) => {
  const pageErrors = [];
  const apiErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api') && response.status() >= 400) {
      apiErrors.push({ path: url.pathname, status: response.status() });
    }
  });

  const token = await login('student');
  const beforeSearches = await ok('GET', '/students/me/saved-searches', token);
  const beforeIds = new Set(beforeSearches.map((item) => item.id));

  const account = credentials().student;
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/candidate\/dashboard/);

  try {
    // 1. Saved Searches navigation, CRUD, and Apply Filter
    await page.goto('/candidate/jobs');
    await expect(page.getByRole('heading', { level: 1, name: 'Tìm việc' })).toBeVisible();
    await expect(page.getByLabel('Điều hướng Ứng viên').getByRole('link', { name: 'Tìm kiếm đã lưu' })).toBeVisible();

    await page.locator('#main-content').getByRole('link', { name: 'Tìm kiếm đã lưu' }).click();
    await expect(page).toHaveURL('/candidate/jobs/saved-searches');
    await expect(page.getByRole('heading', { level: 1, name: 'Tìm kiếm đã lưu' })).toBeVisible();

    await page.getByLabel('Tên bộ lọc').fill('W1A Browser Verify');
    await page.getByLabel('Từ khóa').fill('Backend Java');
    await page.getByLabel('Địa điểm').fill('Ho Chi Minh City');
    await page.getByLabel('Loại hình').selectOption('INTERNSHIP');
    await page.getByLabel('Hình thức').selectOption('HYBRID');
    await page.getByRole('button', { name: 'Lưu tìm kiếm' }).click();

    const createdHeading = page.getByRole('heading', { name: 'W1A Browser Verify', exact: true });
    await expect(createdHeading).toBeVisible();

    const createdCard = createdHeading.locator('..').locator('..');
    await createdCard.getByRole('button', { name: 'Sửa' }).click();
    await page.getByLabel('Tên bộ lọc').fill('W1A Browser Verify Updated');
    await page.getByRole('button', { name: 'Cập nhật' }).click();

    const updatedHeading = page.getByRole('heading', { name: 'W1A Browser Verify Updated', exact: true });
    await expect(updatedHeading).toBeVisible();

    const updatedCard = updatedHeading.locator('..').locator('..');
    await updatedCard.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();

    await expect(page).toHaveURL(/\/candidate\/jobs\?/);
    await expect(page.getByLabel('Từ khóa')).toHaveValue('Backend Java');
    await expect(page.getByLabel('Địa điểm')).toHaveValue('Ho Chi Minh City');
    await expect(page.getByLabel('Loại hình')).toHaveValue('INTERNSHIP');
    await expect(page.getByLabel('Hình thức')).toHaveValue('HYBRID');

    // Clean up the temporary saved search via UI
    await page.locator('#main-content').getByRole('link', { name: 'Tìm kiếm đã lưu' }).click();
    await expect(page).toHaveURL('/candidate/jobs/saved-searches');
    const cardToDelete = page.getByRole('heading', { name: 'W1A Browser Verify Updated', exact: true }).locator('..').locator('..');
    await cardToDelete.getByRole('button', { name: 'Xóa' }).click();
    await expect(page.getByRole('heading', { name: 'W1A Browser Verify Updated', exact: true })).toHaveCount(0);

    // 2. CV V2 Analysis metadata on /candidate/cvs/:cvId/analysis
    const readyCvId = manifest.cvs.student[0].id;
    await page.goto(`/candidate/cvs/${readyCvId}/analysis`);
    await expect(page.getByRole('heading', { level: 1, name: 'Phân tích CV' })).toBeVisible();
    await expect(page.getByText('bilingual-nlp-v2-skills-v1')).toBeVisible();
    await expect(page.getByText(/Tiếng Anh \(en\)|Tiếng Việt \(vi\)/)).toBeVisible();
    await expect(page.getByText(/%\s*\(0\.\d{4}\)|100\.0%\s*\(1\.0000\)/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cảnh báo phân tích' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Nội dung CV đã xử lý, cuộn để đọc' })).toBeVisible();

    // 3. Deterministic CV Review on /candidate/cvs/:cvId/review
    await page.getByRole('link', { name: 'Đánh giá CV' }).click();
    await expect(page).toHaveURL(`/candidate/cvs/${readyCvId}/review`);
    await expect(page.getByRole('heading', { level: 1, name: 'Đánh giá CV' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trạng thái sẵn sàng cho gợi ý việc làm V3' })).toBeVisible();
    await expect(page.getByText('Đủ điều kiện (Sẵn sàng)')).toBeVisible();
    await expect(page.getByText('bilingual-nlp-v2-skills-v1 (Khớp chuẩn V3)')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Định tuyến chiến lược đối sánh ngôn ngữ V3' })).toBeVisible();
    await expect(page.getByText('PRIMARY — SAME_LANGUAGE_HYBRID (65% văn bản TF-IDF + 35% kỹ năng)')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Thống kê dữ liệu trích xuất thực tế' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nhận xét & Hướng dẫn cải thiện minh bạch' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Nội dung CV đã xử lý, cuộn để đọc' })).toHaveCount(0);
  } finally {
    const afterSearches = await ok('GET', '/students/me/saved-searches', token);
    for (const item of afterSearches) {
      if (!beforeIds.has(item.id)) {
        await ok('DELETE', `/students/me/saved-searches/${item.id}`, token);
      }
    }
  }

  expect(pageErrors).toEqual([]);
  expect(apiErrors).toEqual([]);
});
