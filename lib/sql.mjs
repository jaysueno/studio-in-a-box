// The seed dump format. Plain SQL, data only, sorted, and identical for identical rows.

export const DUMP_TABLES = [
  { table: 'public.staff', key: 'staff', columns: ['id', 'full_name', 'role'] },
  { table: 'public.members', key: 'members', columns: ['id', 'full_name', 'email', 'joined_on'] },
  {
    table: 'public.packages',
    key: 'packages',
    columns: ['id', 'member_id', 'name', 'credits', 'price', 'purchased_at', 'expires_on'],
  },
  {
    table: 'public.classes',
    key: 'classes',
    columns: ['id', 'name', 'instructor_id', 'starts_at', 'duration_minutes', 'capacity'],
  },
  {
    table: 'public.bookings',
    key: 'bookings',
    columns: ['id', 'member_id', 'class_id', 'package_id', 'booked_at'],
  },
  {
    table: 'public.credit_ledger',
    key: 'ledger',
    columns: ['id', 'package_id', 'member_id', 'kind', 'credits', 'occurred_at'],
  },
  {
    table: 'public.payments',
    key: 'payments',
    columns: ['id', 'member_id', 'package_id', 'amount', 'method', 'paid_at', 'recorded_by'],
  },
  {
    table: 'public.cash_close',
    key: 'closes',
    columns: ['day', 'expected', 'counted', 'difference', 'note', 'signed_off_by', 'closed_at'],
  },
];

export function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function renderDump(data) {
  const lines = [
    '-- studio-in-a-box seed dump',
    '-- Data only, sorted, no timestamp. Regenerate with pnpm seed -- --seed 7 and pnpm dump:seed.',
    'begin;',
  ];
  for (const entry of DUMP_TABLES) {
    const rows = [...(data[entry.key] || [])].sort((a, b) => {
      const left = String(a[entry.columns[0]]);
      const right = String(b[entry.columns[0]]);
      return left < right ? -1 : left > right ? 1 : 0;
    });
    for (const row of rows) {
      const values = entry.columns.map((column) => sqlValue(row[column]));
      lines.push(
        `insert into ${entry.table} (${entry.columns.join(', ')}) values (${values.join(', ')});`,
      );
    }
  }
  lines.push('commit;', '');
  return lines.join('\n');
}
