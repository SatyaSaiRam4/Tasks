/**
 * Small hand-rolled date/time formatting helpers.
 *
 * Deliberately avoids Intl.DateTimeFormat's locale-dependent formatting,
 * since Hermes's ICU support varies by build — these are simple and predictable
 * on every device instead.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTime(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '';
  const hours24 = d.getHours();
  const minutes = pad2(d.getMinutes());
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}

export function formatShortDate(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '';
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/** e.g. "Today, 4:30 PM" / "Tomorrow, 9:00 AM" / "Mon, Sep 28, 4:30 PM" */
export function formatDayLabel(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '';
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, tomorrow)) return 'Tomorrow';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '';
  return `${formatDayLabel(iso)}, ${formatTime(iso)}`;
}

export function formatFullDate(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '';
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Converts a Date to an ISO 8601 string suitable for the backend's scheduled_at field. */
export function toIsoString(date: Date): string {
  return date.toISOString();
}
