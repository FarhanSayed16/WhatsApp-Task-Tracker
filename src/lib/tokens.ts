import { nanoid } from "nanoid";
import { supabase } from "./supabase";
import { TOKEN_LENGTH } from "./constants";

/**
 * Generates an unguessable URL-safe string
 */
export function generateToken(length = TOKEN_LENGTH): string {
  return nanoid(length);
}

/**
 * Generates a unique task token with database collision retry logic (up to 3 attempts)
 */
export async function generateUniqueTaskToken(): Promise<string> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const token = generateToken();

    try {
      const { data, error } = await supabase
        .from("task_lists")
        .select("id")
        .eq("token", token)
        .maybeSingle();

      if (!error && !data) {
        return token;
      }
    } catch {
      // In dev fallback before DB connection, return the generated token directly
      return token;
    }
  }

  // Fallback with longer token if 3 collisions occurred
  return nanoid(16);
}
