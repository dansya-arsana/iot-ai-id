import {test, expect} from '@playwright/test';
test('button-led: chat revision creates executable draft, simulated run proves behavior sequence', async ({page}) => {
  await page.goto('/build');
  await page.fill('#hero-goal', 'Buat tombol dan LED: tekan tombol maka indikator menyala.');
  await page.getByRole('button', {name: /Build it/}).click();
  await page.waitForURL(/\/project\//);
  await expect(page.locator('.school-status')).toContainText('Siap belajar', {timeout: 45000});
  await expect(page.locator('.react-flow__nodes')).toContainText('Button assembly');
  await page.getByRole('button', {name: /Jalankan latihan/}).click();
  await expect(page.locator('.school-status')).toContainText('Latihan lolos', {timeout: 45000});
  await page.locator('.school-tabbar').getByRole('tab', {name: 'Uji'}).click();
  await expect(page.getByText('Input tombol terbaca')).toBeVisible();
  await expect(page.getByText('Urutan tekan-lepas lengkap')).toBeVisible();
});
