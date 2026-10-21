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

/**
 * Native WhatsApp app protocol — skips the api.whatsapp.com "Open app" webpage.
 * Still cannot target a group; with a phone it opens that 1:1 composer.
 */
export function waAppLink(text: string, phone?: string | null): string {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "";
  const safe = sanitizeWhatsAppText(text);
  const phonePart = cleanPhone ? `phone=${cleanPhone}&` : "";
  return `whatsapp://send?${phonePart}text=${encodeURIComponent(safe)}`;
}

/**
 * Builds an official web.whatsapp.com link for direct browser tab dispatch.
 * Ideal for desktop browsers to bypass desktop app protocol mangling.
 */
export function waWebLink(text: string, phone?: string | null): string {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "";
  const base = cleanPhone
    ? `https://web.whatsapp.com/send?phone=${cleanPhone}`
    : "https://web.whatsapp.com/send";
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
 * Strip characters that WhatsApp Desktop often shows as diamond 
 * (emoji, keycaps, symbols, replacement chars). Keeps letters, digits, punctuation,
 * newlines, and WhatsApp *bold* / _italic_ markers.
 */
export function sanitizeWhatsAppText(text: string): string {
  if (!text) return "";
  return text
    // Normalize line endings to avoid %0D%0A Windows CRLF breakage in URLs
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove Unicode replacement character (diamond question mark)
    .replace(/\uFFFD/g, "")
    // Remove keycap number emojis (e.g. 1️⃣, 2️⃣, #️⃣)
    .replace(/[\d#*]\uFE0F?\u20E3/gu, "")
    // Remove emoji & symbol blocks (keeps basic Latin + punctuation + Indian scripts)
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{E0020}-\u{E007F}]/gu,
      ""
    )
    // Remove symbols and bullets that corrupt on Windows WhatsApp Desktop protocol handlers
    .replace(/[•·▪▫▸►‣◆◇○●★☆⚠✅❌🔔📋👉⏰📅👥🚨👏▫️🔗📌📝]/g, "")
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

/** Professional assignment message right after creation. */
export function buildAssignmentMessage(params: {
  title: string;
  groupName: string;
  dateStr: string;
  dueTimeStr?: string | null;
  items: string[];
  link: string;
  style?: "numbered" | "bullets";
}): string {
  const maxShown = Math.min(params.items.length, 20);
  const isNumbered = params.style !== "bullets";

  const lines = params.items.slice(0, maxShown).map((item, idx) => {
    const clean = sanitizeWhatsAppText(String(item || ""));
    const prefix = isNumbered ? `${idx + 1}.` : "-";
    return `${prefix} ${clean}`;
  });

  const overflow = params.items.length - maxShown;
  if (overflow > 0) {
    lines.push(`(+${overflow} more tasks - open link below)`);
  }

  const dateLabel = formatWaDate(params.dateStr);
  const cleanTitle = sanitizeWhatsAppText(params.title);
  const cleanGroup = sanitizeWhatsAppText(params.groupName);

  const parts: string[] = [
    `*NEW ASSIGNMENT: ${cleanTitle.toUpperCase()}*`,
    `----------------------------------------`,
    `*Group:* ${cleanGroup}`,
    `*Date:* ${dateLabel}`,
  ];

  if (params.dueTimeStr) {
    parts.push(`*Due:* ${params.dueTimeStr}`);
  }

  parts.push(
    `----------------------------------------`,
    `*Tasks to Complete:*`,
    ...lines,
    ``,
    `*Tick Done Online:*`,
    params.link
  );

  return sanitizeWhatsAppText(parts.join("\n"));
}

/**
 * Professional, clean checklist message — ASCII + WhatsApp *bold* only.
 * 100% immune to emoji diamond  glitches across all platforms.
 */
export function buildTaskMessage(params: {
  title: string;
  groupName: string;
  dateStr: string;
  dueTimeStr?: string | null;
  items: string[];
  link: string;
  style?: "numbered" | "bullets";
}): string {
  const maxShown = Math.min(params.items.length, 20);
  const isNumbered = params.style !== "bullets";

  const lines = params.items.slice(0, maxShown).map((item, idx) => {
    const clean = sanitizeWhatsAppText(String(item || ""));
    const prefix = isNumbered ? `${idx + 1}.` : "-";
    return `${prefix} ${clean}`;
  });

  const overflow = params.items.length - maxShown;
  if (overflow > 0) {
    lines.push(`(+${overflow} more tasks - open link below)`);
  }

  const dateLabel = formatWaDate(params.dateStr);
  const cleanTitle = sanitizeWhatsAppText(params.title);
  const cleanGroup = sanitizeWhatsAppText(params.groupName);

  const parts: string[] = [
    `*TASK CHECKLIST: ${cleanTitle.toUpperCase()}*`,
    `----------------------------------------`,
    `*Group:* ${cleanGroup}`,
    `*Date:* ${dateLabel}`,
  ];

  if (params.dueTimeStr) {
    parts.push(`*Due:* ${params.dueTimeStr}`);
  }

  parts.push(
    `----------------------------------------`,
    `*Tasks to Complete:*`,
    ...lines,
    ``,
    `*Tick Done Online:*`,
    params.link
  );

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
  style?: "numbered" | "bullets";
}): string {
  const type = params.type || (params.memberName ? "individual" : "group");
  const isNumbered = params.style !== "bullets";

  const listBlock = (items: string[], limit: number) => {
    const slice = items.slice(0, limit);
    const body = slice.map((x, i) => {
      const clean = sanitizeWhatsAppText(String(x || ""));
      return `${isNumbered ? `${i + 1}.` : "-"} ${clean}`;
    });
    if (items.length > limit) {
      body.push(`(+${items.length - limit} more items - open link below)`);
    }
    return body;
  };

  const cleanTitle = sanitizeWhatsAppText(params.title);
  const cleanGroup = sanitizeWhatsAppText(params.groupName);

  let parts: string[] = [];

  if (type === "individual") {
    parts = [
      params.memberName ? `*Hi ${params.memberName.trim()}*` : `*Hello*`,
      `----------------------------------------`,
      `*REMINDER: ${cleanTitle.toUpperCase()}*`,
      `*Group:* ${cleanGroup}`,
    ];
    if (params.dueTimeStr) parts.push(`*Due by:* ${params.dueTimeStr}`);
    parts.push(
      `----------------------------------------`,
      `*Your Pending Tasks:*`,
      ...listBlock(params.pendingItems, 8),
      ``,
      `*Tick Done Online:*`,
      params.link
    );
  } else if (type === "overdue") {
    parts = [
      `*URGENT: TASKS OVERDUE*`,
      `----------------------------------------`,
      `*List:* ${cleanTitle.toUpperCase()}`,
      `*Group:* ${cleanGroup}`,
      `----------------------------------------`,
      `*Pending Tasks:*`,
      ...listBlock(params.pendingItems, 8),
      ``,
      `*Submit Updates Immediately:*`,
      params.link
    ];
  } else if (type === "closure") {
    parts = [
      `*REVIEW COMPLETE*`,
      `----------------------------------------`,
      `*List:* ${cleanTitle.toUpperCase()}`,
      `*Group:* ${cleanGroup}`,
      `----------------------------------------`,
      `All tasks have been verified and recorded.`,
      `Thank you for completing on time.`
    ];
  } else {
    parts = [
      `*REMINDER: PENDING TASKS*`,
      `----------------------------------------`,
      `*List:* ${cleanTitle.toUpperCase()}`,
      `*Group:* ${cleanGroup}`,
    ];
    if (params.dueTimeStr) parts.push(`*Due:* ${params.dueTimeStr}`);
    parts.push(
      `----------------------------------------`,
      `*Tasks Remaining (${params.pendingItems.length}):*`,
      ...listBlock(params.pendingItems, 8),
      ``,
      `*Tick Done Online:*`,
      params.link
    );
  }

  return sanitizeWhatsAppText(parts.join("\n"));
}
