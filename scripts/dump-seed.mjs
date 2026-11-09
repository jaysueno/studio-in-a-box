// Write supabase/seed-dump.sql from the loaded studio: plain SQL, data only, sorted, and with no
// timestamp of the run. Two runs over the same seed write the same bytes.
//
//   pnpm dump:seed
//
// Reads DATABASE_URL. The default is the local Supabase database.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import pg from 'pg';
import { DUMP_TABLES, renderDump } from '../lib/sql.mjs';

const DEFAULT_URL = 'postgresql://postgres:postgres@localhost:54322/postgres';
const OUT = fileURLToPath(new URL('../supabase/seed-dump.sql', import.meta.url));

const STAMP = (column) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
const DATE = (column) => `to_char(${column}, 'YYYY-MM-DD')`;
const TEXT = (column) => `${column}::text`;

// Table specific expressions, so every value comes back as text and the formatter stays dumb.
const SELECTS = {
  'public.staff': ['id', 'full_name', 'role'].map((c) => [c, TEXT(c)]),
  'public.members': [
    ['id', TEXT('id')], ['full_name', 'full_name'], ['email', 'email'],
    ['joined_on', DATE('joined_on')],
  ],
  'public.packages': [
    ['id', TEXT('id')], ['member_id', TEXT('member_id')], ['name', 'name'],
    ['credits', TEXT('credits')], ['price', TEXT('price')],
    ['purchased_at', STAMP('purchased_at')], ['expires_on', DATE('expires_on')],
  ],
  'public.classes': [
    ['id', TEXT('id')], ['name', 'name'], ['instructor_id', TEXT('instructor_id')],
    ['starts_at', STAMP('starts_at')], ['duration_minutes', TEXT('duration_minutes')],
    ['capacity', TEXT('capacity')],
  ],
  'public.bookings': [
    ['id', TEXT('id')], ['member_id', TEXT('member_id')], ['class_id', TEXT('class_id')],
    ['package_id', TEXT('package_id')], ['booked_at', STAMP('booked_at')],
  ],
  'public.credit_ledger': [
    ['id', TEXT('id')], ['package_id', TEXT('package_id')], ['member_id', TEXT('member_id')],
    ['kind', 'kind'], ['credits', TEXT('credits')], ['occurred_at', STAMP('occurred_at')],
  ],
  'public.payments': [
    ['id', TEXT('id')], ['member_id', TEXT('member_id')], ['package_id', TEXT('package_id')],
    ['amount', TEXT('amount')], ['method', 'method'], ['paid_at', STAMP('paid_at')],
    ['recorded_by', TEXT('recorded_by')],
  ],
  'public.cash_close': [
    ['day', DATE('day')], ['expected', TEXT('expected')], ['counted', TEXT('counted')],
    ['difference', TEXT('difference')], ['note', 'note'],
    ['signed_off_by', TEXT('signed_off_by')], ['closed_at', STAMP('closed_at')],
  ],
};

async function main() {
  const url = process.env.DATABASE_URL || DEFAULT_URL;
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const data = {};
  try {
    await client.query("set time zone 'UTC'");
    for (const entry of DUMP_TABLES) {
      const selects = SELECTS[entry.table];
      const projection = selects.map(([alias, expression]) => `${expression} as ${alias}`);
      const order = entry.columns[0];
      const result = await client.query(
        `select coalesce(json_agg(row_to_json(q)), '[]'::json) as rows
           from (select ${projection.join(', ')} from ${entry.table} order by ${order}) q`,
      );
      data[entry.key] = result.rows[0].rows;
    }
  } finally {
    await client.end();
  }

  const text = renderDump(data);
  writeFileSync(OUT, text, 'utf8');
  const nonEmpty = text.split('\n').filter((line) => line.trim()).length;
  console.log(`wrote supabase/seed-dump.sql (${nonEmpty} non-empty lines)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
