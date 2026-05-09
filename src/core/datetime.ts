/**
 * Helpers for resolving WordPress local datetime strings with site timezone metadata.
 */

export interface WordPressDateTimeResolution {
  /** ISO 8601 datetime with the resolved numeric offset appended. */
  iso: string;
  /** Numeric offset formatted for ISO 8601 strings. */
  offset: string;
  /** Numeric timezone offset at this instant, in minutes east of UTC. */
  offsetMinutes: number;
  /** IANA timezone used to resolve the local datetime. */
  timezone: string;
  /** Original WordPress local datetime value. */
  value: string;
}

interface DateTimeParts {
  day: number;
  fractional?: string;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}

const WORDPRESS_LOCAL_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/;

/**
 * Resolves a raw WordPress local datetime using a known WordPress site timezone.
 */
export function resolveWordPressDateTime(
  value: string,
  timezone: string | undefined,
): WordPressDateTimeResolution | undefined {
  if (!timezone) return undefined;

  const parts = parseWordPressLocalDateTime(value);
  if (!parts || !isValidTimeZone(timezone)) return undefined;

  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsetMinutes = resolveStableOffsetMinutes(timezone, utcGuess);
  if (offsetMinutes === undefined) return undefined;

  const resolvedInstant = new Date(utcGuess - offsetMinutes * 60_000);
  if (
    !matchesLocalDateTime(
      parts,
      getTimeZoneDateTimeParts(timezone, resolvedInstant),
    )
  ) {
    return undefined;
  }

  const offset = formatOffset(offsetMinutes);

  return {
    iso: `${formatLocalDateTime(parts)}${offset}`,
    offset,
    offsetMinutes,
    timezone,
    value,
  };
}

function resolveStableOffsetMinutes(
  timezone: string,
  utcGuess: number,
): number | undefined {
  let offset = getTimeZoneOffsetMinutes(timezone, new Date(utcGuess));

  for (let attempt = 0; attempt < 4; attempt++) {
    const resolvedInstant = new Date(utcGuess - offset * 60_000);
    const nextOffset = getTimeZoneOffsetMinutes(timezone, resolvedInstant);
    if (nextOffset === offset) return offset;
    offset = nextOffset;
  }

  return undefined;
}

function parseWordPressLocalDateTime(value: string): DateTimeParts | undefined {
  const match = WORDPRESS_LOCAL_DATETIME.exec(value);
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second, fractional] = match;

  return {
    day: Number(day),
    fractional,
    hour: Number(hour),
    minute: Number(minute),
    month: Number(month),
    second: Number(second),
    year: Number(year),
  };
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function getTimeZoneOffsetMinutes(timezone: string, date: Date): number {
  const parts = getTimeZoneDateTimeParts(timezone, date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return Math.round((asUtc - date.getTime()) / 60_000);
}

function getTimeZoneDateTimeParts(timezone: string, date: Date): DateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  });
  const parts: Partial<Record<keyof DateTimeParts, number>> = {};

  for (const part of formatter.formatToParts(date)) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      parts[part.type] = Number(part.value);
    }
  }

  return {
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    month: parts.month ?? 0,
    second: parts.second ?? 0,
    year: parts.year ?? 0,
  };
}

function matchesLocalDateTime(
  source: DateTimeParts,
  target: DateTimeParts,
): boolean {
  return (
    source.year === target.year &&
    source.month === target.month &&
    source.day === target.day &&
    source.hour === target.hour &&
    source.minute === target.minute &&
    source.second === target.second
  );
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");

  return `${sign}${hours}:${minutes}`;
}

function formatLocalDateTime(parts: DateTimeParts): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}${parts.fractional ?? ""}`;
}
