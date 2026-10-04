/**
 * Small hand-rolled date helpers. Deliberately avoids Intl formatting, since
 * Hermes's ICU support varies by build.
 *
 * Date keys ("YYYY-MM-DD") are calendar days as the *server* decides them
 * (in the user's timezone); the app uses the server's `today` for anything
 * streak-related and the device clock only for display.
 */

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Backend weekday numbering: 0 = Monday … 6 = Sunday. */
export const WEEKDAYS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "YYYY-MM-DD" → local Date at midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function diffDays(aKey: string, bKey: string): number {
  return Math.round((fromDateKey(aKey).getTime() - fromDateKey(bKey).getTime()) / 86_400_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "07:30:00" or a Date → "7:30 AM". */
export function formatClock(value: string | Date | null | undefined): string {
  if (!value) return '';
  let h: number;
  let m: number;
  if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) {
    [h, m] = value.split(':').map(Number);
  } else {
    const d = typeof value === 'string' ? parseIso(value) : value;
    if (!d) return '';
    h = d.getHours();
    m = d.getMinutes();
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${period}`;
}

export const formatTime = formatClock;

/** For a date key: "Today" / "Tomorrow" / "Yesterday" / "Fri, Oct 8". */
export function relativeDayLabel(key: string, todayKey: string): string {
  const diff = diffDays(key, todayKey);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = fromDateKey(key);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Mon, Oct 4" */
export function formatDayShort(key: string): string {
  const d = fromDateKey(key);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Oct 4, 2026" */
export function formatFullDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? fromDateKey(value) : parseIso(value)) : value;
  if (!d) return '';
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "01 Oct" style for date ranges. */
export function formatDayMonth(key: string): string {
  const d = fromDateKey(key);
  return `${pad2(d.getDate())} ${MONTH_SHORT[d.getMonth()]}`;
}

/** For an ISO datetime: "Today, 4:30 PM" etc., relative to the device's today. */
export function formatDateTime(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return '';
  return `${relativeDayLabel(toDateKey(d), toDateKey(new Date()))}, ${formatClock(d)}`;
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function greetingFor(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
