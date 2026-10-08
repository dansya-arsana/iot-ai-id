import {test, expect} from '@playwright/test';

test('landing keeps prompt, honest demo, mobile navigation and responsive width', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.landing-page')).toBeVisible();
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Give AI hands.');
  await page.getByRole('button', {name: 'Use room monitor example'}).click();
  await expect(page.locator('#hero-goal')).toHaveValue('Build an ESP32 room monitor with temperature/humidity and an OLED.');
  await expect(page.getByText('Interactive illustration. No hardware control.')).toBeVisible();
  await page.getByRole('button', {name: 'Disconnect SDA'}).click();
  await expect(page.getByText('MISMATCH DETECTED', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Reconnect SDA'})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Reconnect SDA'}).click();
  await expect(page.getByText('DEMO CHECKS PASS', {exact: true})).toBeVisible();
  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({width, height: 900});
    await expect(page.locator('#hero-goal')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.getByRole('heading', {level: 1}).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(96);
  }
  await page.locator('.mobile-nav summary').click();
  await expect(page.getByRole('navigation', {name: 'Mobile navigation'})).toBeVisible();
  await page.getByRole('navigation', {name: 'Mobile navigation'}).getByRole('link', {name: 'Build', exact: true}).click();
  await expect(page).toHaveURL(/\/build$/);
  await expect(page.locator('.landing-page')).toHaveCount(0);
});
