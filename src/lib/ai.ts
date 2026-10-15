import { GoogleGenerativeAI } from "@google/generative-ai";
import { parsePastedTasks } from "@/lib/utils";
import type { TaskPriority } from "@/types";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Free tier rate limiter: max 15 requests per minute
const requestTimestamps: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 15;

function checkRateLimit(): boolean {
  const now = Date.now();
  // Purge older than 60s
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  requestTimestamps.push(now);
  return true;
}

export interface ParsedAITaskItem {
  text: string;
  suggested_priority: TaskPriority;
  suggested_due?: string | null;
}

export interface ReminderContext {
  taskListTitle: string;
  groupName: string;
  totalItems: number;
  completedItems: number;
  pendingItems: string[];
  overdueCount: number;
  link: string;
  language?: "en" | "hi" | "mr";
  tone?: "polite" | "urgent" | "firm";
}

/**
 * Parses unstructured messy text (meeting notes, messages, voice transcripts)
 * into a clean list of actionable checklist task items with suggested priorities.
 */
export async function parseTextToTasks(text: string): Promise<ParsedAITaskItem[]> {
  if (!text || !text.trim()) return [];

  // Fallback helper if Gemini is unconfigured or rate limited
  const fallbackParse = (): ParsedAITaskItem[] => {
    const lines = parsePastedTasks(text);
    return lines.map((line) => {
      let priority: TaskPriority = "normal";
      const lower = line.toLowerCase();
      if (lower.includes("urgent") || lower.includes("asap") || lower.includes("important") || lower.includes("critical")) {
        priority = "high";
      } else if (lower.includes("optional") || lower.includes("fyi") || lower.includes("later")) {
        priority = "low";
      }
      return {
        text: line,
        suggested_priority: priority,
      };
    });
  };

  if (!genAI || !checkRateLimit()) {
    console.warn("Gemini AI unavailable or rate-limited. Falling back to rule-based line parser.");
    return fallbackParse();
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const prompt = `You are a helpful assistant for a university professor managing student projects and team tasks.
Extract all discrete, actionable tasks and checklist items from the following input text or spoken transcript.

Rules:
1. Break down complex or compound sentences into single concise actionable items.
2. Clean up punctuation, remove filler words like "um", "ah", "and then", and remove numbering/bullets.
3. Suggest a priority: "high" (if urgent/deadline-critical), "low" (if optional or trivial), otherwise "normal".
4. If a specific time or deadline is mentioned in the text (e.g. "by 5pm", "before Friday"), capture it in suggested_due, otherwise null.
5. Return a JSON array of objects with the exact schema:
[
  {
    "text": "Task description here",
    "suggested_priority": "high" | "normal" | "low",
    "suggested_due": "string or null"
  }
]

Input text:
"""
${text}
"""`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        text: String(item.text || "").trim(),
        suggested_priority:
          item.suggested_priority === "high" ||
          item.suggested_priority === "low"
            ? item.suggested_priority
            : "normal",
        suggested_due: item.suggested_due || null,
      })).filter((item: ParsedAITaskItem) => item.text.length > 0);
    }

    return fallbackParse();
  } catch (err) {
    console.error("Gemini parseTextToTasks error, falling back:", err);
    return fallbackParse();
  }
}

/**
 * Drafts a WhatsApp reminder message tailored to pending items and team tone.
 * Supports English, Hindi, and Marathi.
 */
export async function draftContextualReminder(context: ReminderContext): Promise<string> {
  const {
    taskListTitle,
    groupName,
    totalItems,
    completedItems,
    pendingItems,
    overdueCount,
    link,
    language = "en",
    tone = "polite",
  } = context;

  // Fallback template
  const fallbackReminder = () => {
    const pendingList = pendingItems.slice(0, 3).map((t) => `• ${t}`).join("\n");
    if (language === "hi") {
      return `📢 *रिमाइंडर: ${taskListTitle}*\n\nनमस्ते ${groupName} टीम,\nकृपया अपने बाकी काम पूरे करें:\n${pendingList}\n\n👉 *यहाँ चेक करें:* ${link}\nधन्यवाद!`;
    }
    if (language === "mr") {
      return `📢 *स्मरणपत्र: ${taskListTitle}*\n\nनमस्कार ${groupName} टीम,\nकृपया उर्वरित कामे पूर्ण करा:\n${pendingList}\n\n👉 *येथे तपासा:* ${link}\nधन्यवाद!`;
    }
    return `📢 *Reminder: ${taskListTitle}*\n\nHi ${groupName} team,\nQuick reminder to complete remaining tasks (${completedItems}/${totalItems} done):\n${pendingList}\n${
      overdueCount > 0 ? `\n⚠️ *${overdueCount} task(s) are overdue!*` : ""
    }\n\n👉 *Mark completed here:* ${link}\nThank you!`;
  };

  if (!genAI || !checkRateLimit()) {
    return fallbackReminder();
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.4,
      },
    });

    const langName =
      language === "hi"
        ? "Hindi (Devanagari script, natural colloquial tone)"
        : language === "mr"
        ? "Marathi (Devanagari script, natural polite tone)"
        : "English";

    const prompt = `You are an AI assistant for a college professor sending a WhatsApp reminder to student project group members.
Write a short, engaging WhatsApp message to remind students to complete their tasks.

Context:
- Task List: "${taskListTitle}"
- Group Name: "${groupName}"
- Progress: ${completedItems} of ${totalItems} tasks completed
- Remaining Pending Tasks: ${pendingItems.slice(0, 4).join(", ")}
- Overdue count: ${overdueCount}
- Link placeholder to include at the end: ${link}
- Target Language: ${langName}
- Desired Tone: ${tone} (e.g. polite and encouraging, or urgent if overdue)

Formatting instructions:
1. Use WhatsApp markdown (*bold* for headlines/list title, emojis for bullet points).
2. Keep it concise (under 5-6 lines total) so students read it immediately.
3. Clearly mention the remaining tasks and include the link: ${link}.
4. Return ONLY the raw WhatsApp text message with no surrounding quotes or explanations.`;

    const result = await model.generateContent(prompt);
    const msg = result.response.text().trim();
    return msg || fallbackReminder();
  } catch (err) {
    console.error("Gemini draftContextualReminder error, using fallback:", err);
    return fallbackReminder();
  }
}
