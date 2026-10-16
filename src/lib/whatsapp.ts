import {
  MAX_WA_URL_LENGTH,
  WA_URL_WARNING_THRESHOLD,
} from "./constants";

/**
 * Builds an official wa.me deep link.
 * - With phone → opens that 1:1 chat
 * - Without phone → opens WhatsApp chat picker (for groups)
 */
export function waLink(text: string, phone?: string | null): string {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "";
  const base = cleanPhone ? `https://wa.me/${cleanPhone}` : "https://wa.me/";
  // Normalize before encode — strips broken emoji that become diamond � on WA Desktop
  const safe = sanitizeWhatsAppText(text);
  return `${base}?text=${encodeURIComponent(safe)}`;
}

export function getEncodedUrlLength(text: string, phone?: string | null): number {
  return waLink(text, phone).length;
}

export function inspectWaUrl(
  text: string,
  phone?: string | null
): {
  url: string;
  length: number;
  isWarning: boolean;
  isExceeded: boolean;
} {
  const url = waLink(text, phone);
  const length = url.length;
  return {
    url,
    length,
    isWarning: length >= WA_URL_WARNING_THRESHOLD && length <= MAX_WA_URL_LENGTH,
    isExceeded: length > MAX_WA_URL_LENGTH,
  };
}

export function interpolateTemplate(
  template: string,
  data: Record<string, string | number | undefined | null>
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : "";
  });
}

/**
 * Strip characters that WhatsApp Desktop often shows as diamond �
 * (emoji, symbols, replacement chars). Keeps letters, digits, punctuation,
 * newlines, and WhatsApp *bold* / _italic_ markers.
 */
export function sanitizeWhatsAppText(text: string): string {
  return text
    // Remove already-broken replacement characters
    .replace(/\uFFFD/g, "")
    // Remove emoji & symbol blocks (keeps basic Latin + common punctuation)
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
      ""
    )
    // Remove other common "pretty" unicode that breaks in wa.me on Windows WA
    .replace(/[•·▪▫▸►‣◆◇○●★☆⚠✅❌🔔📋👉⏰📅👥🚨👏▫️]/g, "")
    // Collapse leftover double spaces from stripped chars (keep newlines)
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Readable ASCII date for WhatsApp. */
export function formatWaDate(dateStr: string): string {
  if (!dateStr) return "";
  if (/[a-zA-Z]/.test(dateStr) && !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr;
  }
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[Number(m[2]) - 1] || m[2];
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/**
 * Format due datetime for WhatsApp.
 * Accepts ISO timestamptz or already-human strings / HH:mm.
 */
export function formatWaDueTime(
  dueInput?: string | null,
  timeZone = "Asia/Kolkata"
): string | undefined {
  if (!dueInput) return undefined;
  const trimmed = dueInput.trim();
  if (!trimmed) return undefined;

  // Already a clock time like 17:30
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return sanitizeWhatsAppText(trimmed);

  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/** Assignment message right after create (clearer than generic share). */
export function buildAssignmentMessage(params: {
  title: string;
  groupName: string;
  dateStr: string;
  dueTimeStr?: string | null;
  items: string[];
  link: string;
}): string {
  const body = buildTaskMessage(params);
  // Replace first title line with assignment headline + title
  const lines = body.split("\n");
  if (lines.length > 0 && lines[0].startsWith("*") && lines[0].endsWith("*")) {
    lines[0] = `*New checklist assigned*`;
    lines.splice(1, 0, `*${params.title.trim()}*`);
  } else {
    lines.unshift(`*New checklist assigned*`, `*${params.title.trim()}*`);
  }
  return sanitizeWhatsAppText(lines.join("\n"));
}

/**
 * Clean, organised checklist message — ASCII + WhatsApp *bold* only.
 * No emoji (they become diamond � on many WhatsApp Desktop / wa.me paths).
 */
export function buildTaskMessage(params: {
  title: string;
  groupName: string;
  dateStr: string;
  dueTimeStr?: string | null;
  items: string[];
  link: string;
}): string {
  const maxShown = Math.min(params.items.length, 15);
  const lines = params.items.slice(0, maxShown).map((item, idx) => {
    const clean = String(item || "")
      .replace(/\s+/g, " ")
      .trim();
    return `${idx + 1}) ${clean}`;
  });

  const overflow = params.items.length - maxShown;
  if (overflow > 0) {
    lines.push(`(+${overflow} more - open the link)`);
  }

  const dateLabel = formatWaDate(params.dateStr);
  const parts: string[] = [
    `*${params.title.trim()}*`,
    `${params.groupName.trim()}`,
    `Date: ${dateLabel}`,
  ];

  if (params.dueTimeStr) {
    parts.push(`Due: ${params.dueTimeStr}`);
  }

  parts.push("", "*Tasks*", ...lines, "", "*Tick done here*", params.link);

  return sanitizeWhatsAppText(parts.join("\n"));
}

export type ReminderType = "group" | "individual" | "overdue" | "closure";

export function buildReminderMessage(params: {
  type?: ReminderType;
  title: string;
  groupName: string;
  pendingItems: string[];
  link: string;
  memberName?: string;
  dueTimeStr?: string | null;
}): string {
  const type = params.type || (params.memberName ? "individual" : "group");

  const listBlock = (items: string[], limit: number) => {
    const slice = items.slice(0, limit);
    const body = slice.map((x, i) => `${i + 1}) ${String(x).replace(/\s+/g, " ").trim()}`);
    if (items.length > limit) {
      body.push(`(+${items.length - limit} more - open the link)`);
    }
    return body;
  };

  let parts: string[] = [];

  if (type === "individual") {
    parts = [
      params.memberName
        ? `Hi *${params.memberName}*,`
        : `Hi,`,
      `Gentle reminder for *${params.title}* (${params.groupName}):`,
      "",
      "*Pending*",
      ...listBlock(params.pendingItems, 6),
    ];
    if (params.dueTimeStr) parts.push("", `Due by: ${params.dueTimeStr}`);
    parts.push("", "*Please check off here*", params.link);
  } else if (type === "overdue") {
    parts = [
      `*URGENT - Overdue*`,
      params.groupName,
      `Past due for *${params.title}*:`,
      "",
      ...listBlock(params.pendingItems, 6),
      "",
      "*Submit updates here*",
      params.link,
    ];
  } else if (type === "closure") {
    parts = [
      `*Review complete*`,
      params.groupName,
      `All tasks for *${params.title}* have been reviewed.`,
      `Thank you for submitting on time.`,
    ];
  } else {
    parts = [
      `*Reminder* - ${params.pendingItems.length} pending`,
      `*${params.title}*`,
      params.groupName,
      "",
      "*Pending*",
      ...listBlock(params.pendingItems, 8),
    ];
    if (params.dueTimeStr) parts.push("", `Due: ${params.dueTimeStr}`);
    parts.push("", "*Check off here*", params.link);
  }

  return sanitizeWhatsAppText(parts.join("\n"));
}
