# studio-in-a-box

The software that runs my studios is private, because it is full of real people. This is a slice
of it rebuilt clean for an invented studio: bookings, package credits kept as a ledger that must
balance, an end-of-day cash close, roles enforced in the database, and a plain UI on top. A seed
script invents the studio with a fixed seed, so every run is the same studio.

## What it does

![The seeded studio at a glance: 60 members, 60 packages, 188 signed ledger rows, 24 classes over four weeks and 126 bookings, plus one cash close at 1,347.00 expected, 1,347.00 counted and 0.00 difference.](docs/img/hero.svg)

Cedarline Studio is invented; any resemblance to a real studio is a coincidence. The software
around it is real enough to study. A member sees the schedule, books a class with a credit, and
reads their own credit history. The desk sees the day, records payments, and closes the cash
drawer. The owner sees all of it, signs the close, and expires what has run out.

Every rule that matters lives in the database: a member reads only their own rows, the desk cannot
touch the credit ledger, an instructor sees only their own rosters, and every booking goes through
one function that takes the credit and writes the booking together. A bug in a client cannot spend
a credit twice or reopen a closed day.

The whole slice is here: the database, the seed, the tests, and a plain web app on top.

## The app

![The member schedule: a grid of classes with seats left and a Book button on each one.](docs/img/app-schedule.png)

Four screens, one role switcher:

- `/login` signs in as one of four seeded demo users: a member, the front desk, an instructor and
  the owner. One shared local password, `cedarline-demo-2027`. It protects nothing: the stack is
  local and every row is invented.
- `/schedule` lists classes with a seat left and a Book button. A booking calls `book_class`.
- `/me` shows the signed-in member's credits, their booking history, and the Book and Cancel
  controls. A cancellation calls `cancel_booking`.
- `/desk` shows a day's payments and bookings and lets the front desk book a class for any member.
- `/close` shows a day's expected cash, the counted amount, the difference, a note, and the owner's
  sign-off. `/close?day=YYYY-MM-DD` picks the day; with no parameter it shows the latest day with
  payments. A closed day is read only.

The app never decides permissions. It reads the rows row level security returns and lets the
database refuse. A member who opens the desk or the close sees a plain "Not allowed" page.

The close before sign-off:

![The close: expected cash, the counted drawer, the difference and the owner's sign-off, on an open day.](docs/img/app-close.png)

![The demo: a member books a class and the credits drop from one to zero, then the owner counts the drawer short, writes a note and closes the day.](docs/img/demo.gif)

## Run it

```bash
pnpm install
supabase start
pnpm seed -- --seed 7
pnpm env:local
pnpm dev
```

`supabase start` needs Docker and prints the local URLs, including Studio. The seed reads
`DATABASE_URL` and defaults to the local database at
`postgresql://postgres:postgres@localhost:54322/postgres`. Running `pnpm seed` again empties the
studio tables and loads the same studio, row for row. It prints the demo password and the four demo
emails.

`pnpm env:local` writes `.env.local` with the local API URL and the anon key from `supabase status`.
The app uses only that key and the signed-in user's session. Open `http://localhost:3000` after
`pnpm dev`.

The demo calendar is fixed in early 2027 so every run is the same studio. After March 2027, seed
with `--anchor` and today's date:

```bash
pnpm seed -- --seed 7 --anchor "$(date +%F)"
```

The anchor moves every date so the first class week starts on that day.

To write the deterministic data record:

```bash
pnpm dump:seed   # writes supabase/seed-dump.sql
```

## Test it

```bash
pnpm test          # offline unit tests with Vitest
pnpm build         # the production build, no environment needed
supabase test db   # the eight pgTAP files against the local database
pnpm e2e           # the eight Playwright flows, after supabase start and the seed
```

`pnpm test` covers the seeded random generator, the studio generator and the dump formatter. It
needs no database and no network.

`supabase test db` proves the row level security, the append-only ledger, the balance, the booking
function and the close trigger. Every test builds its own rows as the database owner, then switches
role and claim, so a clean `supabase db reset` passes with no seed data at all.

`pnpm e2e` starts the app itself on port 3100, signs in through the role switcher, and runs eight
flows: book, cancel, the zero-credit refusal, a desk booking, the two refusals, the owner's close,
and the closed day. It needs the local stack and a fresh seed, and prints the list report.

CI runs the same commands: install with a frozen lockfile, `pnpm test`, `pnpm build`, start the
local stack, `supabase test db`, seed, and `pnpm e2e`.

## How it works

### The ledger and the balance

Every credit movement is one row in `credit_ledger`: an issue when a package is sold, a use when a
class is booked, an expire when a package runs out, and a refund when a credit is returned.

| kind | credits | meaning |
|---|---|---|
| issue | positive | a package adds credits |
| use | negative | a booking spends one credit |
| expire | negative | unused credits run out |
| refund | positive | a credit comes back |

`credits` is a signed integer, and a check constraint requires the sign to match the kind. A
trigger repeats the check and refuses every UPDATE and DELETE on the table, so the only way a
balance can change is a new row.

Remaining credits is `member_credits`, a view. It sums the ledger for each package and has one row
per package, including packages at zero. Nothing stores a balance on a package, so a package and
its ledger cannot drift apart.

### Booking a class

`book_class(p_member uuid, p_class uuid) returns uuid` is the only way a booking is created. No
application role can insert into `bookings` directly. It is a security definer function with a
fixed search path, and it runs as one transaction:

1. Take an advisory lock on the member, then lock the class row.
2. Refuse a class that has started or has no free seat.
3. Find the member's oldest package that still has a balance and is valid on the class date.
4. Refuse when the member has no valid credit.
5. Write the booking and one `use` row of minus one, from that package.

A member may book only for themselves. A front-desk user or the owner may book for any member; a
booking by anyone else raises. The package the function writes always belongs to the booked member.
Two bookings for the last credit serialize on the member lock. One wins, the balance ends at zero,
and it never goes below zero.

### Cancelling a booking

`cancel_booking(p_booking uuid) returns void` is the only way a booking is cancelled. The booked
member, a front-desk user or the owner may cancel; anyone else raises. A booking that is already
cancelled is refused, and so is one whose class has started. The function sets `cancelled_at` and
writes one `refund` row of plus one on the same member and package, in one transaction. A
cancelled booking stops counting toward class capacity, so the seat can be booked again.

No application role can update or delete a `bookings` row directly. There is no update or delete
policy and no grant, and a trigger raises for any row change that does not come from
`cancel_booking`, so even a direct write by the database owner is refused.

### When credits expire

A package carries `expires_on`. Booking only spends from a package that expires on or after the
class date, so an expired package cannot pay for a class. The owner runs
`expire_credits(p_as_of date)`: for every package dated before that day with credits left, it
writes one `expire` row equal to minus the remaining balance and returns how many rows it wrote.
A second run finds nothing and returns zero. Only the owner may call it.

### Roles

| Role | Reads | Writes |
|---|---|---|
| member | own member row, own packages, own ledger, own bookings, own payments, the schedule | nothing directly; books and cancels through `book_class` and `cancel_booking` |
| instructor | classes, and the roster of their own classes | nothing |
| front desk | members, classes, bookings, packages, payments, the ledger (read only), the close | bookings through `book_class`, cancellations through `cancel_booking`, packages, payments, classes, and an open close row while it has no sign-off |
| owner | everything | everything the desk writes, cancellations for any member, the close sign-off for their own id, and `expire_credits` |

No policy allows INSERT, UPDATE or DELETE on `credit_ledger` for an application role. The functions
write it as the database owner, and the trigger refuses UPDATE and DELETE for everyone, including
the owner. `anon` can execute nothing in `public`.

### The close

`cash_close` stores `expected`, `counted`, `difference`, `note`, `signed_off_by` and `closed_at`.
The desk may edit an open row only while `signed_off_by` is null. Only an owner may set
`signed_off_by`, and only to their own id. A trigger refuses a row with `closed_at` set when
`difference` is not zero and the note is empty or the signer is not an owner.

Once a row has `closed_at` set, it is final. A BEFORE UPDATE OR DELETE trigger raises for every
caller, the owner included, so no policy change can reopen a day. The trigger never recomputes
`expected`; the desk sets it from the day's cash payments, and the seed sets it from the payments
it generated.

![The schema: members, bookings, classes, packages, credit_ledger, member_credits, payments, cash_close and staff, with the foreign keys between them and a note that book_class, cancel_booking and expire_credits are the only paths that write the ledger.](docs/img/schema.svg)

```
member --> book_class() --> booking
                              |
                              +--> credit_ledger: use, -1

member, desk or owner --> cancel_booking() --> bookings.cancelled_at
                                          +--> credit_ledger: refund, +1

package --> issue, +N --> credit_ledger --> member_credits (view: sum per package)

staff --> classes (instructor) --> bookings
staff --> cash_close (owner sign-off)
owner --> expire_credits(as of) --> credit_ledger: expire, minus remaining
payments (cash or card) --> cash_close: expected is the cash total
```

## What it will not do

- No cloud project, no deploy, no hosted database, no account and no key.
- No real payments. Cash and card are labels on a synthetic row.
- No emails or notifications.
- No real data of any kind: the studio, the people, the classes and the prices are invented by the
  seed.

## License

MIT. See LICENSE.
