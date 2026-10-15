import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { apiError } from "@/lib/errors";

export async function GET(_req: NextRequest) {
  const session = await getServerSession();
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  return new NextResponse("%PDF-1.4 placeholder", {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
