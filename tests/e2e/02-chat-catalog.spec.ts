import {test, expect} from '@playwright/test';
const GOAL = 'Build an ESP32 room monitor with temperature, humidity and an OLED.';
async function readyProject(page: import('@playwright/test').Page) {
  await page.goto('/build');
  await page.fill('#hero-goal', GOAL);
  await page.getByRole('button', {name: /Build it/}).click();
  await page.waitForURL(/\/project\//);
  await expect(page.locator('.school-status')).toContainText('Siap belajar', {timeout: 45000});
}
test('chat pin revision creates immutable contract revision', async ({page}) => {
  await readyProject(page);
  await page.getByRole('button',{name:'Buka chat',exact:true}).click();
  await page.fill('#hardware-message', 'Pindahkan SDA ke GPIO18.');
  await page.getByRole('button', {name: /Kirim pesan/}).click();
  await expect(page.locator('.chat-message.assistant').last()).toBeVisible({timeout: 45000});
  await expect(page.locator('.school-tabbar')).toContainText('Revisi 2', {timeout: 30000});
  await page.locator('[data-id="bme280"]').click();
  await expect(page.getByLabel('Sambungan bme280 SDA')).toHaveValue('18');
});
test('catalog LED add creates planning-only draft and blocks execution', async ({page}) => {
  await readyProject(page);
  await page.getByRole('button',{name:'＋ Parts'}).click();
  const ledItem = page.locator('.catalog-item', {hasText: 'LED with 330Ω resistor'});
  await ledItem.getByRole('button', {name: 'Tambah'}).click();
  await expect(page.locator('.design-draft')).toContainText('belum executable', {timeout: 30000});
  await expect(page.locator('.catalog-drop')).toContainText('LED with 330Ω resistor');
  await expect(page.getByRole('button', {name: /Jalankan latihan|Kompilasi, unggah & uji/})).toBeDisabled();
});
test('unsupported chat goal stays planning-only', async ({page}) => {
  await readyProject(page);
  await page.getByRole('button',{name:'Buka chat',exact:true}).click();
  await page.fill('#hardware-message', 'Tambahkan alarm jarak ultrasonic HC-SR04.');
  await page.getByRole('button', {name: /Kirim pesan/}).click();
  await expect(page.locator('.design-draft')).toContainText('belum executable', {timeout: 45000});
  await expect(page.getByRole('button', {name: /Jalankan latihan|Kompilasi, unggah & uji/})).toBeDisabled();
});
