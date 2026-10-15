import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/errors";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  return apiSuccess({ token, itemId: id, status: "pending", message: "Item reset to pending placeholder" });
}
