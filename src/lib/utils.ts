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
 * Computes link status and expiry:
 * Rule 1: Soft-deleted lists are 'expired'
 * Rule 2: A list becomes 'readonly' when due_at + 7 days has passed.
 * If due_at is null, use list_date end-of-day + 7 days.
 */
export function computeLinkStatus(
  deletedAt: string | null | undefined,
  listDate: string,
  dueAt?: string | null
): { status: "active" | "readonly" | "expired"; expiresAt: Date } {
  if (deletedAt) {
    return {
      status: "expired",
      expiresAt: new Date(deletedAt),
    };
  }

  const baseDate = dueAt ? new Date(dueAt) : new Date(`${listDate}T23:59:59.999Z`);
  const expiryTime = new Date(baseDate.getTime() + MEMBER_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

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

/**
 * Calculates start and end ISO dates for date range filtering ('today' | 'week' | 'month' | 'custom')
 */
export function getDateRange(
  filter: "today" | "week" | "month" | "custom",
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const now = new Date();

  if (filter === "custom" && customFrom && customTo) {
    return {
      from: `${customFrom}T00:00:00.000Z`,
      to: `${customTo}T23:59:59.999Z`,
    };
  }

  if (filter === "today") {
    const todayStr = now.toISOString().slice(0, 10);
    return {
      from: `${todayStr}T00:00:00.000Z`,
      to: `${todayStr}T23:59:59.999Z`,
    };
  }

  if (filter === "week") {
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      from: `${monday.toISOString().slice(0, 10)}T00:00:00.000Z`,
      to: `${sunday.toISOString().slice(0, 10)}T23:59:59.999Z`,
    };
  }

  // Month
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    from: `${firstDay.toISOString().slice(0, 10)}T00:00:00.000Z`,
    to: `${lastDay.toISOString().slice(0, 10)}T23:59:59.999Z`,
  };
}
