import { DEFAULT_TIMEZONE, MEMBER_LINK_EXPIRY_DAYS } from "./constants";
import type { TaskItemStatus } from "@/types";

/**
 * Merge class names conditionally
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}

/**
 * Strips HTML tags and suspicious characters from user input
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<[^>]*>?/gm, "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Truncates text with ellipsis if exceeding maxLength
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

/**
 * Formats a Date or ISO string into a human-readable date in the given timezone
 */
export function formatDate(
  dateInput: string | Date,
  timeZone = DEFAULT_TIMEZONE,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(d);
}

/**
 * Formats a Date or ISO string into a 12-hour time string (e.g. 5:30 PM)
 */
export function formatTime(
  dateInput: string | Date,
  timeZone = DEFAULT_TIMEZONE
): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Returns human relative time strings ("just now", "10m ago", "2h ago", "yesterday", etc.)
 */
export function formatRelativeTime(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(d);
}

/**
 * Computes whether a task is overdue.
 * Rule: status === 'pending' AND due_at !== null AND due_at < now()
 */
export function isOverdue(
  dueAt: string | null | undefined,
  status: TaskItemStatus
): boolean {
  if (status !== "pending" || !dueAt) return false;
  const dueDate = new Date(dueAt);
  return !isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now();
}

/**
 * End of calendar day (23:59:59.999) for YYYY-MM-DD in the given IANA timezone.
 */
export function endOfDayInTimeZone(
  dateStr: string,
  timeZone: string = DEFAULT_TIMEZONE
): Date {
  const utcGuess = new Date(`${dateStr}T23:59:59.999Z`);
  if (isNaN(utcGuess.getTime())) return utcGuess;

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(utcGuess)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
    999
  );
  const offset = asUTC - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}

/**
 * Computes public member-link status and expiry (Core Business Rules):
 * - Soft-deleted → expired
 * - completed / archived → readonly
 * - due_at + 7 days (or list_date EOD in admin TZ + 7 days) past → readonly
 */
export function computeLinkStatus(
  deletedAt: string | null | undefined,
  listDate: string,
  dueAt?: string | null,
  options?: {
    listStatus?: string | null;
    timeZone?: string;
  }
): { status: "active" | "readonly" | "expired"; expiresAt: Date } {
  if (deletedAt) {
    return {
      status: "expired",
      expiresAt: new Date(deletedAt),
    };
  }

  const timeZone = options?.timeZone || DEFAULT_TIMEZONE;
  const baseDate = dueAt
    ? new Date(dueAt)
    : endOfDayInTimeZone(listDate, timeZone);
  const expiryTime = new Date(
    baseDate.getTime() + MEMBER_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  const listStatus = options?.listStatus;
  if (listStatus === "archived" || listStatus === "completed") {
    return { status: "readonly", expiresAt: expiryTime };
  }

  if (Date.now() > expiryTime.getTime()) {
    return {
      status: "readonly",
      expiresAt: expiryTime,
    };
  }

  return {
    status: "active",
    expiresAt: expiryTime,
  };
}

/** Member write APIs may only mutate when status is active */
export function canMemberMutateList(
  status: "active" | "readonly" | "expired"
): boolean {
  return status === "active";
}

/**
 * Convert a calendar date + local time in an IANA timezone to a UTC ISO string.
 * Example: ("2026-10-15", "17:30", "Asia/Kolkata") → ISO for 12:00 UTC that day.
 */
export function zonedDateTimeToUtcIso(
  dateStr: string,
  timeStr: string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const utcGuess = new Date(`${dateStr}T${normalizedTime}.000Z`);
  if (isNaN(utcGuess.getTime())) return utcGuess.toISOString();

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(utcGuess)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  const offset = asUTC - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset).toISOString();
}

/** Calendar YYYY-MM-DD in an IANA timezone */
export function calendarDateInTimeZone(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Calculates start and end calendar dates for filtering ('today' | 'week' | 'month' | 'custom')
 * in the admin timezone. Returns YYYY-MM-DD bounds (list_date is a date column).
 */
export function getDateRange(
  filter: "today" | "week" | "month" | "custom",
  customFrom?: string,
  customTo?: string,
  timeZone: string = DEFAULT_TIMEZONE
): { from: string; to: string } {
  if (filter === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  const todayStr = calendarDateInTimeZone(new Date(), timeZone);
  const [y, m, d] = todayStr.split("-").map(Number);

  if (filter === "today") {
    return { from: todayStr, to: todayStr };
  }

  if (filter === "week") {
    // Build a Date at noon UTC for the calendar day, then walk Mon–Sun in that TZ
    const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const weekdayName = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(noon);
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayOfWeek = weekdayMap[weekdayName] ?? noon.getUTCDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(noon);
    monday.setUTCDate(noon.getUTCDate() - distanceToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    return {
      from: calendarDateInTimeZone(monday, timeZone),
      to: calendarDateInTimeZone(sunday, timeZone),
    };
  }

  // Month in admin TZ
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDayNum = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${y}-${String(m).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
  return { from: first, to: last };
}

/**
 * Splits pasted multi-line text into clean discrete tasks:
 * - Splits by newlines
 * - Strips numbers (e.g. "1.", "1)", "(1)"), bullets ("-", "*", "•", "▫️"), and whitespace
 * - Removes empty lines
 */
export function parsePastedTasks(rawText: string): string[] {
  if (!rawText) return [];
  return rawText
    .split(/\r?\n/)
    .map((line) => {
      return line
        .replace(/^(\(?\d+[\.\)]|[-*•▫️■►])\s*/, "")
        .trim();
    })
    .filter((line) => line.length > 0);
}

