import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { apiError } from "@/lib/errors";

export async function GET(_req: NextRequest) {
  const session = await getServerSession();
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const csvContent = "Group,List Title,Date,Item Text,Status,Completed By,Completed At\n";
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="task-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
