// ═════════════════════════════════════════════════════════════
// WhatsApp Task Tracker — Application Constants (Locked v1.2)
// ═════════════════════════════════════════════════════════════

export const APP_NAME = "WhatsApp Task Tracker";
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

// Auth & Session
export const SESSION_COOKIE_NAME = "wt_session";
export const SESSION_MAX_AGE_DAYS = 30;
export const SESSION_DURATION_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60; // 30 days
export const SESSION_REFRESH_AFTER_DAYS = 7;
export const SESSION_REFRESH_THRESHOLD_SECONDS = SESSION_REFRESH_AFTER_DAYS * 24 * 60 * 60; // 7 days
export const BCRYPT_SALT_ROUNDS = 10;

// Rate Limiting
export const MAX_PIN_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MINUTES = 15;
export const GLOBAL_RATE_LIMIT_HOUR = 30;

export const LOGIN_RATE_LIMIT = {
  WINDOW_MINUTES: RATE_LIMIT_WINDOW_MINUTES,
  MAX_ATTEMPTS: MAX_PIN_ATTEMPTS,
  GLOBAL_HOUR_MAX: GLOBAL_RATE_LIMIT_HOUR,
};

export const PUBLIC_WRITE_RATE_LIMIT_PER_MINUTE = 60;
export const PUBLIC_API_RATE_LIMIT = {
  WINDOW_SECONDS: 60,
  MAX_REQUESTS: PUBLIC_WRITE_RATE_LIMIT_PER_MINUTE,
};

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Tokens & Limits
export const TOKEN_LENGTH = 10;
export const MAX_TASK_ITEMS = 50;
export const MEMBER_LINK_EXPIRY_DAYS = 7;
export const SWR_POLL_INTERVAL_MS = 15000;

// WhatsApp Message & URL Safety
export const MAX_WHATSAPP_URL_LENGTH = 2048;
export const MAX_WA_URL_LENGTH = MAX_WHATSAPP_URL_LENGTH;
export const WA_URL_WARNING_THRESHOLD = 1800;

// Extended number emojis 1 through 10 (Review Fix #23)
export const NUMBER_EMOJIS = [
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
  "🔟",
] as const;
