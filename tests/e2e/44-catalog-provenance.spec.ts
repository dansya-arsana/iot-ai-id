import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
// Staff catalog page (plan M2 A3). The catalog routes are mocked so the spec checks the UI contract, not A2's storage.
const fixture = JSON.parse(readFileSync('packages/catalog/fixtures/farm-parts.json', 'utf8'));
const proposals = [{id: 'pr-1', partId: 'soil-capacitive', status: 'pending', by: 'member:m1', at: '2026-10-20', reason: 'supply range', source: 'https://example.com/ds.pdf'}];

test('catalog page shows provenance, filters, proposal decisions and the lab badge rule', async ({page}) => {
  const decisions: string[] = [];
  const labCalls: unknown[] = [];
  await page.route('**/ops/v1/catalog/parts*', r => r.fulfill({json: {parts: fixture.parts}}));
  await page.route('**/ops/v1/catalog/proposals', r => r.fulfill({json: {proposals}}));
  await page.route('**/ops/v1/catalog/proposals/*/*', r => { decisions.push(new URL(r.request().url()).pathname); return r.fulfill({json: {ok: true}}); });
  await page.route('**/ops/v1/catalog/parts/*/lab-tested', r => { labCalls.push(r.request().postDataJSON()); return r.fulfill({json: {ok: true}}); });
  await page.goto('/backoffice#bo-catalog');
  const section = page.locator('#bo-catalog');
    await expect(section.getByTestId('catalog-part')).toHaveCount(fixture.parts.length);
  const first = section.getByTestId('catalog-part').first();
  await first.getByRole('button').first().click();
  await expect(first.locator('.cat-prov').first()).toContainText('import');
  await section.getByLabel('Filter').selectOption('unverified');
  await expect(section.getByTestId('catalog-part').first()).toBeVisible();
  await section.getByLabel('Filter').selectOption('low');
  await expect(section.getByText('No parts match this filter.')).toBeVisible();
  await section.getByRole('button', {name: 'Approve'}).click();
  expect(decisions[0]).toContain('/proposals/pr-1/approve');
  await section.getByLabel('Filter').selectOption('all');
  await first.getByRole('button').first().click();
  const submit = first.getByRole('button', {name: 'Mark tested in lab'});
  await expect(submit).toBeDisabled();
  await first.getByLabel('Lab Mitra task id').fill('task-0001');
  await submit.click();
  expect(labCalls).toEqual([{taskId: 'task-0001'}]);
});
