# AGENTS.md

Instructions for an AI agent working in this repo.

## Install

```bash
pnpm install
pnpm exec playwright install chromium
```

Node 20 or newer and the Supabase CLI. `supabase start` needs Docker. The Playwright browser is
needed once for the e2e flows and the screenshots.

## Run

```bash
supabase start
pnpm seed -- --seed 7
pnpm env:local
pnpm dev
pnpm dump:seed
```

Both seed commands read `DATABASE_URL` and default to the local database at
`postgresql://postgres:postgres@localhost:54322/postgres`. `pnpm seed` truncates the studio tables
first, so running it twice leaves the same studio, and prints the demo password and the four demo
emails. `pnpm dump:seed` writes `supabase/seed-dump.sql` from the loaded rows.

`pnpm env:local` writes `.env.local` with the local URL and the anon key. `pnpm dev` serves the app
on port 3000 and reads `PORT` when it is set.

## Test

```bash
pnpm test
pnpm build
supabase test db
pnpm e2e
```

CI runs the same commands after `pnpm install --frozen-lockfile`, then starts the local stack,
runs the database tests, seeds, and runs the browser flows.

## Where you may edit

- `supabase/migrations/`: numbered, forward-only migrations. A behavior change needs a new file.
- `supabase/tests/`: the pgTAP files. Keep the seven contract names and their assertion descriptions.
- `app/`, `components/`: the screens and their client controls. Mark a page dynamic if it reads
  the session.
- `lib/`, `scripts/`, `test/`: the generator, the seed, the dump, the local env writer and their
  tests.
- `e2e/`, `playwright.config.ts`: the browser flows. Keep the test titles the ruler names.
- `docs/img/make.mjs`: the diagram source. Run `pnpm images` to rewrite the two SVGs; never
  hand-edit an SVG.
- `README.md`, `AGENTS.md`: plain technical prose.
- `supabase/seed-dump.sql`: only through `pnpm dump:seed`.

## Where you may not edit

- The opening story of `README.md` (the section under the title). It is the owner's words.
- `LICENSE`.
- The published data record: do not hand-edit `supabase/seed-dump.sql`.

## Never

- Never create a cloud project, a deploy, an account or a key. This repo runs locally only.
- Never put a service-role key in the app, in a component, in a script or in the client build. The
  app uses the anon key and the signed-in user's session only.
- Never put real data in the seed or a test: no real people, emails, phone numbers, addresses,
  business names or prices. The generator invents everything from the seed.
- Never make the generator or the dump read the clock, `Math.random` or the network.
- Never weaken a pgTAP test, a row level security policy or a trigger to make a run pass.
- Never grant an application role INSERT, UPDATE or DELETE on `credit_ledger`.
- Never insert, update or delete a booking row directly; every booking goes through
  `book_class`, and every cancellation through `cancel_booking`.
- Never update or delete a cash close row once `closed_at` is set.
- Never call `expire_credits` as anyone but the owner.
- Never write a numeric loopback address; use `localhost`.
- Never use em dashes in prose.

## Before each commit

Run `pnpm test`, `pnpm build`, `supabase test db`, `pnpm e2e`, and `pnpm images`. Then check the
tree for real names, home paths and business terms; a private identity scan runs before anything is
published.
