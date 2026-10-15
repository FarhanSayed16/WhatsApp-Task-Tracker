import { clearSessionCookie } from "@/lib/auth";
import { apiSuccess } from "@/lib/errors";

export async function POST() {
  await clearSessionCookie();
  return apiSuccess({ message: "Logged out successfully" });
}
