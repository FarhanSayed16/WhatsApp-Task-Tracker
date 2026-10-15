import {
  NUMBER_EMOJIS,
  MAX_WA_URL_LENGTH,
  WA_URL_WARNING_THRESHOLD,
} from "./constants";

/**
 * Builds an official wa.me deep link
 * If phone is provided, targets that phone; otherwise opens WhatsApp chat picker.
 */
export function waLink(text: string, phone?: string | null): string {
  // Strip + and non-numeric chars from phone
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "";
  const base = cleanPhone ? `https://wa.me/${cleanPhone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Returns the exact character length of the full wa.me URL after encoding
 */
export function getEncodedUrlLength(text: string, phone?: string | null): number {
  return waLink(text, phone).length;
}

/**
 * Inspects URL length against mobile browser & WhatsApp limits (~2048 chars)
 */
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

/**
 * Replaces template placeholders: {group}, {title}, {date}, {due}, {items}, {link}, {name}, {pending_count}
 */
export function interpolateTemplate(
  template: string,
  data: Record<string, string | number | undefined | null>
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : "";
  });
}

/**
 * Builds the standard task list message for WhatsApp
 */
export function buildTaskMessage(params: {
  title: string;
  groupName: string;
  dateStr: string;
  dueTimeStr?: string | null;
  items: string[];
  link: string;
}): string {
  const maxShown = Math.min(params.items.length, NUMBER_EMOJIS.length);
  const shownItems = params.items
    .slice(0, maxShown)
    .map((item, idx) => `${NUMBER_EMOJIS[idx]} ${item}`)
    .join("\n");

  const overflowCount = params.items.length - maxShown;
  const moreText = overflowCount > 0 ? `\n…and ${overflowCount} more items` : "";

  return [
    `📋 *${params.title}*`,
    `👥 ${params.groupName}  |  📅 ${params.dateStr}`,
    "",
    shownItems + moreText,
    "",
    params.dueTimeStr ? `⏰ *Due:* ${params.dueTimeStr}` : null,
    `👉 *Tick done here:* ${params.link}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export type ReminderType = "group" | "individual" | "overdue" | "closure";

/**
 * Builds a contextual reminder message for pending items
 */
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

  if (type === "individual") {
    const greeting = params.memberName
      ? `Hi *${params.memberName}*, gentle reminder:`
      : `Hi, gentle reminder:`;
    const itemsText = params.pendingItems.slice(0, 5).map((x) => `▫️ ${x}`).join("\n");
    const overflow = params.pendingItems.length > 5 ? `\n…and ${params.pendingItems.length - 5} more` : "";

    return [
      greeting,
      `You have pending tasks for *${params.title}* (${params.groupName}):\n`,
      itemsText + overflow,
      "",
      params.dueTimeStr ? `⏰ *Due by:* ${params.dueTimeStr}\n` : null,
      `👉 *Please check off completed items here:* ${params.link}`,
    ]
      .filter((line) => line !== null)
      .join("\n");
  }

  if (type === "overdue") {
    const itemsText = params.pendingItems.slice(0, 5).map((x) => `⚠️ ${x}`).join("\n");
    return [
      `🚨 *URGENT: Overdue Tasks* — ${params.groupName}`,
      `The following tasks for *${params.title}* are past due:\n`,
      itemsText,
      "",
      `👉 *Submit updates immediately here:* ${params.link}`,
    ].join("\n");
  }

  if (type === "closure") {
    return [
      `✅ *Task Review Complete* — ${params.groupName}`,
      `All assigned tasks for *${params.title}* have been reviewed & verified.`,
      `Thank you for your timely submissions! 👏`,
    ].join("\n");
  }

  // Default: Group reminder
  const itemsText = params.pendingItems.slice(0, 7).map((x) => `▫️ ${x}`).join("\n");
  const overflow = params.pendingItems.length > 7 ? `\n…and ${params.pendingItems.length - 7} more` : "";

  return [
    `🔔 *Reminder:* ${params.pendingItems.length} pending tasks for *${params.title}* (${params.groupName})`,
    "",
    itemsText + overflow,
    "",
    params.dueTimeStr ? `⏰ *Due:* ${params.dueTimeStr}` : null,
    `👉 *Check off completed tasks:* ${params.link}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
