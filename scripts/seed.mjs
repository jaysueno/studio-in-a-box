// Load the generated studio into the local database. Truncates the studio tables first, so a
// second run leaves exactly the same state.
//
//   pnpm seed -- --seed 7
//
// Reads DATABASE_URL. The default is the local Supabase database.

import process from 'node:process';
import pg from 'pg';
import {
  generateStudio, DEFAULT_SEED, DEMO_PASSWORD, DEMO_USERS,
} from '../lib/seed.mjs';

const DEFAULT_URL = 'postgresql://postgres:postgres@localhost:54322/postgres';

function parseSeed(argv) {
  const at = argv.indexOf('--seed');
  if (at === -1) return DEFAULT_SEED;
  const value = Number(argv[at + 1]);
  if (!Number.isInteger(value)) {
    throw new Error('--seed needs a whole number');
  }
  return value;
}

function parseAnchor(argv) {
  const at = argv.indexOf('--anchor');
  if (at === -1) return null;
  const value = argv[at + 1];
  if (!value) throw new Error('--anchor needs a date as YYYY-MM-DD');
  return value;
}

const BATCH = 150;

async function insertRows(client, table, columns, rows) {
  for (let start = 0; start < rows.length; start += BATCH) {
    const chunk = rows.slice(start, start + BATCH);
    const values = [];
    const tuples = chunk.map((row) => {
      const marks = columns.map((column) => {
        values.push(row[column]);
        return `$${values.length}`;
      });
      return `(${marks.join(', ')})`;
    });
    await client.query(
      `insert into ${table} (${columns.join(', ')}) values ${tuples.join(', ')}`,
      values,
    );
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const seed = parseSeed(argv);
  const anchor = parseAnchor(argv);
  const data = generateStudio(seed, anchor ? { anchor } : {});
  const url = process.env.DATABASE_URL || DEFAULT_URL;
  const client = new pg.Client({ connectionString: url });

  await client.connect();
  try {
    await client.query('begin');
    await client.query("set local time zone 'UTC'");

    await client.query(`truncate table
      public.cash_close,
      public.payments,
      public.credit_ledger,
      public.bookings,
      public.classes,
      public.packages,
      public.staff,
      public.members`);
    await client.query("delete from auth.users where email like '%@example.test'");

    const users = [
      ...data.staff.map((entry) => ({ id: entry.id, email: entry.email })),
      ...data.members.map((entry) => ({ id: entry.id, email: entry.email })),
    ];
    await client.query(
      `insert into auth.users
         (instance_id, id, email, aud, role, encrypted_password, email_confirmed_at,
          created_at, updated_at, confirmation_token, recovery_token,
          email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data)
       select '00000000-0000-0000-0000-000000000000', u.id, u.email,
              'authenticated', 'authenticated',
              extensions.crypt($2, extensions.gen_salt('bf', 10)),
              '2027-01-01T00:00:00Z'::timestamptz, '2027-01-01T00:00:00Z'::timestamptz,
              '2027-01-01T00:00:00Z'::timestamptz, '', '', '', '',
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('sub', u.id::text, 'email', u.email,
                                 'email_verified', true, 'phone_verified', false)
         from json_to_recordset($1::json) as u(id uuid, email text)`,
      [JSON.stringify(users), DEMO_PASSWORD],
    );

    await client.query(
      `insert into auth.identities
         (id, user_id, identity_data, provider, provider_id, last_sign_in_at,
          created_at, updated_at)
       select gen_random_uuid(), u.id,
              jsonb_build_object('sub', u.id::text, 'email', u.email),
              'email', u.id::text, now(), now(), now()
         from auth.users u where u.email like '%@example.test'`,
    );

    await insertRows(client, 'public.staff', ['id', 'full_name', 'role'], data.staff);
    await insertRows(client, 'public.members',
      ['id', 'full_name', 'email', 'joined_on'], data.members);
    await insertRows(client, 'public.packages',
      ['id', 'member_id', 'name', 'credits', 'price', 'purchased_at', 'expires_on'],
      data.packages);
    await insertRows(client, 'public.classes',
      ['id', 'name', 'instructor_id', 'starts_at', 'duration_minutes', 'capacity'],
      data.classes);
    await insertRows(client, 'public.bookings',
      ['id', 'member_id', 'class_id', 'package_id', 'booked_at'], data.bookings);
    await insertRows(client, 'public.credit_ledger',
      ['id', 'package_id', 'member_id', 'kind', 'credits', 'occurred_at'], data.ledger);
    await insertRows(client, 'public.payments',
      ['id', 'member_id', 'package_id', 'amount', 'method', 'paid_at', 'recorded_by'],
      data.payments);
    await insertRows(client, 'public.cash_close',
      ['day', 'expected', 'counted', 'difference', 'note', 'signed_off_by', 'closed_at'],
      data.closes);

    await client.query('commit');

    console.log(`seeded ${data.studio.name}, seed ${seed}`
      + (anchor ? `, anchor ${anchor}` : ''));
    console.log(`  staff ${data.staff.length}, members ${data.members.length}, `
      + `classes ${data.classes.length}, packages ${data.packages.length}`);
    console.log(`  bookings ${data.bookings.length}, ledger ${data.ledger.length}, `
      + `payments ${data.payments.length}, closes ${data.closes.length}`);
    console.log('');
    console.log(`local demo password: ${DEMO_PASSWORD}`);
    console.log('demo users:');
    for (const entry of DEMO_USERS) {
      console.log(`  ${entry.label.padEnd(10)} ${entry.email}`);
    }
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
