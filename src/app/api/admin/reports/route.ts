import { NextRequest } from "next/server";
import { getServerSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/errors";

export async function GET(_req: NextRequest) {
  const session = await getServerSession();
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);
  return apiSuccess({ stats: [], message: "Reports data placeholder" });
}
