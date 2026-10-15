import { NextRequest } from "next/server";
import { getServerSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);
  const { id } = await params;
  return apiSuccess({ id, message: "Task list detail placeholder" });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);
  const { id } = await params;
  return apiSuccess({ id, message: "Task list update placeholder" });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);
  const { id } = await params;
  return apiSuccess({ id, message: "Task list delete placeholder" });
}
