// Capture the five screens at 390, 768 and 1440 for the visual QA evidence, and the two README
// images. Run the app first: PORT=3000 pnpm dev. The stack must be seeded (pnpm seed -- --seed 7).
//
//   node scripts/screenshots.mjs /path/to/BATCH-REPORTS/B7b-screens
//

import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { DEMO_USERS } from '../lib/seed.mjs';

const BASE = process.env.APP_URL || 'http://localhost:3000';
const OUT = process.argv[2] || 'screenshots';
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

function emailFor(role) {
  const entry = DEMO_USERS.find((user) => user.role === role);
  if (!entry) throw new Error(`no demo user for ${role}`);
  return entry.email;
}

async function newPage(browser, viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  return { context, page };
}

async function signIn(page, role) {
  await page.goto(`${BASE}/login`);
  await page.getByTestId('role-switcher').selectOption(emailFor(role));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Sign out' }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(300);
}

async function shot(page, file) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`wrote ${file}`);
}

const browser = await chromium.launch();

try {
  mkdirSync(OUT, { recursive: true });

  for (const size of WIDTHS) {
    const label = size.width;

    const login = await newPage(browser, size);
    await login.page.goto(`${BASE}/login`);
    await shot(login.page, `${OUT}/B7b-${label}-login.png`);
    await login.context.close();

    const member = await newPage(browser, size);
    await signIn(member.page, 'member');
    await member.page.goto(`${BASE}/me`);
    const credits = Number(await member.page.getByTestId('credits-remaining').innerText());
    await member.page.goto(`${BASE}/schedule`);
    if (credits > 0) {
      await member.page.getByTestId('book-button').nth(0).click();
      await member.page.waitForTimeout(1500);
    }
    await shot(member.page, `${OUT}/B7b-${label}-schedule.png`);
    await member.page.goto(`${BASE}/me`);
    await shot(member.page, `${OUT}/B7b-${label}-me.png`);
    await member.context.close();

    const desk = await newPage(browser, size);
    await signIn(desk.page, 'front_desk');
    await desk.page.goto(`${BASE}/desk`);
    await shot(desk.page, `${OUT}/B7b-${label}-desk.png`);
    await desk.context.close();

    const owner = await newPage(browser, size);
    await signIn(owner.page, 'owner');
    await owner.page.goto(`${BASE}/close?day=2027-02-10`);
    await shot(owner.page, `${OUT}/B7b-${label}-close.png`);
    await owner.context.close();
  }

  // Two images for the README, 1200 wide, under the 500 KB budget.
  mkdirSync('docs/img', { recursive: true });
  const readmeSize = { width: 1200, height: 800 };
  const readmeMember = await newPage(browser, readmeSize);
  await signIn(readmeMember.page, 'member');
  await readmeMember.page.goto(`${BASE}/schedule`);
  await readmeMember.page.screenshot({ path: 'docs/img/app-schedule.png' });
  console.log('wrote docs/img/app-schedule.png');
  await readmeMember.context.close();

  const readmeOwner = await newPage(browser, readmeSize);
  await signIn(readmeOwner.page, 'owner');
  await readmeOwner.page.goto(`${BASE}/close?day=2027-02-10`);
  await readmeOwner.page.screenshot({ path: 'docs/img/app-close.png' });
  console.log('wrote docs/img/app-close.png');
  await readmeOwner.context.close();
} finally {
  await browser.close();
}
