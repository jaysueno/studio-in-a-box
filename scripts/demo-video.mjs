// Record the demo: a member books a class and the credits drop, then the owner closes the day.
// Run the app first (PORT=3000 pnpm dev) on a fresh seed (pnpm seed -- --seed 7). The script
// records one take, then ffmpeg turns it into docs/img/demo.gif.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { DEMO_USERS } from '../lib/seed.mjs';

const BASE = process.env.APP_URL || 'http://localhost:3000';
const VIDEO_DIR = '.demo-video';
const GIF = 'docs/img/demo.gif';

function emailFor(role) {
  const entry = DEMO_USERS.find((user) => user.role === role);
  if (!entry) throw new Error(`no demo user for ${role}`);
  return entry.email;
}

async function signIn(page, role) {
  await page.getByTestId('role-switcher').selectOption(emailFor(role));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Sign out' }).waitFor({ timeout: 20000 });
}

rmSync(VIDEO_DIR, { recursive: true, force: true });
mkdirSync(VIDEO_DIR, { recursive: true });
mkdirSync('docs/img', { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
  colorScheme: 'light',
});
const page = await context.newPage();

try {
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(2000);

  await signIn(page, 'member');
  await page.waitForTimeout(1500);

  await page.goto(`${BASE}/me`);
  await page.waitForTimeout(2500);

  await page.goto(`${BASE}/schedule`);
  await page.waitForTimeout(2000);
  await page.getByTestId('book-button').nth(0).click();
  await page.waitForTimeout(2000);

  await page.goto(`${BASE}/me`);
  await page.waitForTimeout(3000);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByTestId('role-switcher').waitFor();
  await page.waitForTimeout(1500);

  await signIn(page, 'owner');
  await page.waitForTimeout(1500);

  await page.goto(`${BASE}/close?day=2027-02-10`);
  await page.waitForTimeout(2000);
  const expected = Number(await page.getByTestId('close-expected').innerText());
  await page.getByTestId('close-counted').fill((expected - 10).toFixed(2));
  await page.waitForTimeout(1500);
  await page.getByTestId('close-note').fill('Drawer short by ten. Owner counted at the desk.');
  await page.waitForTimeout(1500);
  await page.getByTestId('close-sign').click();
  await page.getByTestId('close-status').filter({ hasText: 'closed' }).waitFor();
  await page.waitForTimeout(3000);
} finally {
  await context.close();
  await browser.close();
}

const video = readdirSync(VIDEO_DIR).find((name) => name.endsWith('.webm'));
if (!video) throw new Error('Playwright wrote no video file');

execFileSync('/opt/homebrew/bin/ffmpeg', [
  '-y',
  '-i', join(VIDEO_DIR, video),
  '-vf', 'fps=12,scale=1200:-1:flags=lanczos',
  '-loop', '0',
  GIF,
], { stdio: 'inherit' });

const duration = execFileSync('/opt/homebrew/bin/ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', GIF,
], { encoding: 'utf8' }).trim();
console.log(`wrote ${GIF}, ${duration} s`);

rmSync(VIDEO_DIR, { recursive: true, force: true });
