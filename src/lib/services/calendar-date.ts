// ISO calendar dates (yyyy-mm-dd) as the forecast and the START date edit
// understand them. Arithmetic runs on whole day numbers counted from UTC
// midnight, never on local Date arithmetic, so a DST change cannot shift a day.
// Date.UTC maps years 0–99 to 1900–1999, so day numbers are built with
// setUTCFullYear instead.

export const MIN_ISO_DATE = "0001-01-01";
export const MAX_ISO_DATE = "9999-12-31";

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01 for a date given by its parts; the parts may overflow, as with Date. */
function dayNumberOf(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime() / MS_PER_DAY;
}

/** The day number of an ISO date, or undefined when it does not name a real date in range. */
function parse(value: string): number | undefined {
  const match = ISO_DATE.exec(value);
  if (match === null) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1) return undefined;

  const dayNumber = dayNumberOf(year, month, day);
  // A day or month out of range (2026-02-29, 2026-13-01) rolls over into another date.
  const date = new Date(dayNumber * MS_PER_DAY);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return dayNumber;
}

const MIN_DAY_NUMBER = dayNumberOf(1, 1, 1);
const MAX_DAY_NUMBER = dayNumberOf(9999, 12, 31);

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

function format(year: number, monthIndex: number, day: number): string {
  return `${pad(year, 4)}-${pad(monthIndex + 1, 2)}-${pad(day, 2)}`;
}

/** True when `value` is yyyy-mm-dd naming a real calendar date from 0001-01-01 to 9999-12-31. */
export function isIsoDate(value: string): boolean {
  return parse(value) !== undefined;
}

/**
 * `date` plus a whole number of `days`, or undefined when the result falls
 * outside 0001-01-01 to 9999-12-31 (including any sum too large to be exact).
 */
export function addDays(date: string, days: number): string | undefined {
  const dayNumber = parse(date);
  if (dayNumber === undefined) throw new Error(`"${date}" is not an ISO date.`);

  const result = dayNumber + days;
  if (!(result >= MIN_DAY_NUMBER && result <= MAX_DAY_NUMBER)) return undefined;
  const resultDate = new Date(result * MS_PER_DAY);
  return format(resultDate.getUTCFullYear(), resultDate.getUTCMonth(), resultDate.getUTCDate());
}

/** Negative, zero or positive as `a` is before, equal to or after `b`; fixed-width ISO dates also compare lexically. */
export function compareIsoDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Today in the user's time zone, from the local date components of `now`. */
export function todayIsoDate(now: Date): string {
  return format(now.getFullYear(), now.getMonth(), now.getDate());
}
