import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DEMO_USERS } from '../lib/seed.mjs';

async function signIn(page: Page, role: string): Promise<void> {
  const entry = DEMO_USERS.find((user) => user.role === role);
  if (!entry) throw new Error(`no demo user for role ${role}`);
  await page.goto('/login');
  await page.getByTestId('role-switcher').selectOption(entry.email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('member books a class and the credits drop by one', async ({ page }) => {
  await signIn(page, 'member');
  await page.goto('/me');
  const before = Number(await page.getByTestId('credits-remaining').innerText());
  await page.goto('/schedule');
  await page.getByTestId('book-button').nth(0).click();
  await expect(page.getByRole('button', { name: 'Booked' })).toBeVisible();
  await page.goto('/me');
  await expect(page.getByTestId('credits-remaining')).toHaveText(String(before - 1));
});

test('member cancels and the credit returns', async ({ page }) => {
  await signIn(page, 'member');
  await page.goto('/me');
  const before = Number(await page.getByTestId('credits-remaining').innerText());
  await page.getByTestId('cancel-button').first().click();
  await expect(page.getByRole('button', { name: 'Cancelled' })).toBeVisible();
  await page.goto('/me');
  await expect(page.getByTestId('credits-remaining')).toHaveText(String(before + 1));
});

test('zero credits shows the refusal message', async ({ page }) => {
  await signIn(page, 'member');
  await page.goto('/schedule');
  await page.getByTestId('book-button').nth(1).click();
  await expect(page.getByRole('button', { name: 'Booked' })).toBeVisible();
  await page.getByTestId('book-button').nth(2).click();
  await expect(page.getByTestId('booking-error')).toContainText('No credits');
});

test('desk books for a member', async ({ page }) => {
  await signIn(page, 'front_desk');
  await page.goto('/desk');
  await expect(page.getByRole('heading', { name: 'Book for a member' })).toBeVisible();
  await page.getByRole('button', { name: 'Book for this member' }).click();
  await expect(page.getByText('Booked. The credit was taken')).toBeVisible();
});

test('member refused on desk', async ({ page }) => {
  await signIn(page, 'member');
  await page.goto('/desk');
  await expect(page.getByText('Not allowed')).toBeVisible();
});

test('member refused on close', async ({ page }) => {
  await signIn(page, 'member');
  await page.goto('/close');
  await expect(page.getByText('Not allowed')).toBeVisible();
});

test('owner closes the day with a difference and a note', async ({ page }) => {
  await signIn(page, 'owner');
  await page.goto('/close?day=2027-02-10');
  const expected = Number(await page.getByTestId('close-expected').innerText());
  await page.getByTestId('close-counted').fill((expected - 10).toFixed(2));
  await page.getByTestId('close-note').fill('Drawer short by ten. Owner counted at the desk.');
  await page.getByTestId('close-sign').click();
  await expect(page.getByTestId('close-status')).toHaveText('closed');
  await expect(page.getByTestId('close-note')).toBeDisabled();
});

test('closed day cannot be edited', async ({ page }) => {
  await signIn(page, 'owner');
  await page.goto('/close?day=2027-02-11');
  await expect(page.getByTestId('close-status')).toHaveText('closed');
  await expect(page.getByTestId('close-note')).toBeDisabled();
  await expect(page.getByTestId('close-sign')).toBeDisabled();
});
