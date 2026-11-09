export function formatWhen(value: string): string {
  return `${new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))} UTC`;
}

export function formatShortWhen(value: string): string {
  return `${new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))} UTC`;
}

export function money(value: number | string | null | undefined): string {
  return Number(value ?? 0).toFixed(2);
}

export function isoDay(value: string): string {
  return value.slice(0, 10);
}

export function nextDay(day: string): string {
  const millis = Date.parse(`${day}T00:00:00Z`) + 24 * 60 * 60 * 1000;
  return new Date(millis).toISOString().slice(0, 10);
}

export function isValidDay(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

// The studio speaks in plain words. Each database refusal gets one line the reader can act on.
export function plainError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('no credits available')) return 'No credits left. A new package is needed to book this class.';
  if (text.includes('class is full')) return 'That class is full.';
  if (text.includes('already started')) return 'That class has already started.';
  if (text.includes('only book for themselves')) return 'A member can only book for themselves.';
  if (text.includes('only cancel their own')) return 'A member can only cancel their own booking.';
  if (text.includes('already cancelled')) return 'That booking is already cancelled.';
  if (text.includes('duplicate key')) return 'That member already has a booking for this class.';
  if (text.includes('closed day is final')) return 'That day is closed. A closed day cannot be changed.';
  if (text.includes('row-level security')) return 'That change is not allowed for this role.';
  return message;
}
