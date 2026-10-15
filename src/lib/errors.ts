import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiError, ApiSuccess } from "@/types";

export const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  DUPLICATE: "DUPLICATE",
  DB_ERROR: "DB_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES | string;

export function apiSuccess<T>(
  data: T,
  meta?: ApiSuccess<T>["meta"],
  status = 200
): NextResponse {
  const payload: ApiSuccess<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
  return NextResponse.json(payload, { status });
}

export function apiError(
  message: string,
  code: ErrorCode = ERROR_CODES.INVALID_INPUT,
  status = 400,
  details?: unknown
): NextResponse {
  const payload: ApiError = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return NextResponse.json(payload, { status });
}

/**
 * Global handler for catching unknown errors, Zod errors, and database errors safely
 */
export function handleApiError(err: unknown): NextResponse {
  console.error("API Route Error:", err);

  if (err instanceof ZodError) {
    return apiError(
      err.issues[0]?.message || "Validation failed",
      ERROR_CODES.INVALID_INPUT,
      400,
      { issues: err.issues }
    );
  }

  if (err && typeof err === "object" && "name" in err && err.name === "ValidationError") {
    const issues = (err as { issues?: unknown[] }).issues;
    return apiError(
      (err as Error).message || "Invalid input data",
      ERROR_CODES.INVALID_INPUT,
      400,
      { issues }
    );
  }

  if (err instanceof Error) {
    if (err.message.includes("violates unique constraint") || err.message.includes("23505")) {
      return apiError("Record already exists with these details", ERROR_CODES.DUPLICATE, 409);
    }
    return apiError(err.message, ERROR_CODES.INTERNAL_ERROR, 500);
  }

  return apiError("An unexpected server error occurred", ERROR_CODES.INTERNAL_ERROR, 500);
}
