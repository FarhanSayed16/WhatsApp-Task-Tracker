import { z } from "zod";

export class ValidationError extends Error {
  code = "INVALID_INPUT";
  issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    super(issues[0]?.message || "Validation failed");
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/**
 * Validates data against a Zod schema and throws a standardized ValidationError
 */
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues);
  }
  return result.data;
}

// ═════════════════════════════════════════════════════════════
// Auth Schemas
// ═════════════════════════════════════════════════════════════

export const loginSchema = z.object({
  pin: z
    .string()
    .length(6, "PIN must be exactly 6 digits")
    .regex(/^\d{6}$/, "PIN must contain only numbers"),
});

export const changePinSchema = z.object({
  old_pin: z
    .string()
    .length(6, "PIN must be exactly 6 digits")
    .regex(/^\d{6}$/, "PIN must contain only numbers"),
  new_pin: z
    .string()
    .length(6, "PIN must be exactly 6 digits")
    .regex(/^\d{6}$/, "PIN must contain only numbers"),
});

// ═════════════════════════════════════════════════════════════
// Pagination & Filtering Schemas
// ═════════════════════════════════════════════════════════════

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid from date format (YYYY-MM-DD)").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid to date format (YYYY-MM-DD)").optional(),
  group_id: z.string().uuid("Invalid group UUID").optional(),
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
});

// ═════════════════════════════════════════════════════════════
// Group Schemas
// ═════════════════════════════════════════════════════════════

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  verify_required: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  members: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Member name is required").max(100),
        phone: z
          .string()
          .trim()
          .regex(/^[0-9]{10,15}$/, "Phone must be 10-15 digits")
          .optional()
          .nullable(),
      })
    )
    .optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  verify_required: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// ═════════════════════════════════════════════════════════════
// Member Schemas
// ═════════════════════════════════════════════════════════════

export const createMemberSchema = z.object({
  group_id: z.string().uuid("Invalid group ID"),
  name: z.string().trim().min(1, "Member name is required").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10,15}$/, "Phone must be 10-15 digits without symbols")
    .optional()
    .nullable(),
});

export const updateMemberSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10,15}$/, "Phone must be 10-15 digits without symbols")
    .optional()
    .nullable(),
  active: z.boolean().optional(),
});

export const importMembersSchema = z.object({
  group_id: z.string().uuid("Invalid group ID"),
  csv: z.string().min(1, "CSV data is required"),
});

// ═════════════════════════════════════════════════════════════
// Task List Schemas
// ═════════════════════════════════════════════════════════════

export const createTaskListSchema = z.object({
  group_id: z.string().uuid("Invalid group ID"),
  title: z.string().trim().min(1, "Title is required").max(200),
  list_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  due_at: z.string().datetime().optional().nullable(),
  items: z.array(z.string().trim().min(1)).min(1, "At least one task item is required"),
});

export const updateTaskListSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  list_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_at: z.string().datetime().optional().nullable(),
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
});

// ═════════════════════════════════════════════════════════════
// Task Item Schemas
// ═════════════════════════════════════════════════════════════

export const createTaskItemSchema = z.object({
  task_list_id: z.string().uuid("Invalid task list ID"),
  text: z.string().trim().min(1, "Task text is required").max(500),
  position: z.number().int().min(0),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assigned_member_id: z.string().uuid().optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
});

export const updateTaskItemSchema = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  position: z.number().int().min(0).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assigned_member_id: z.string().uuid().optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  status: z.enum(["pending", "done", "verified"]).optional(),
});

export const completeItemSchema = z.object({
  member_id: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const reorderItemsSchema = z.object({
  task_list_id: z.string().uuid(),
  ordered_ids: z.array(z.string().uuid()).min(1),
});

// ═════════════════════════════════════════════════════════════
// Template Schemas
// ═════════════════════════════════════════════════════════════

export const createTemplateSchema = z.object({
  type: z.enum(["checklist", "message"]),
  name: z.string().trim().min(1, "Template name is required").max(100),
  body: z.object({
    items: z.array(z.string()).optional(),
    default_due_offset_hours: z.number().int().min(1).max(168).optional(),
    text: z.string().optional(),
    placeholders: z.array(z.string()).optional(),
  }),
});

// ═════════════════════════════════════════════════════════════
// Public Interaction Schemas
// ═════════════════════════════════════════════════════════════

export const recordOpenSchema = z.object({
  member_id: z.string().uuid("Invalid member ID"),
});

export const recordShareSchema = z.object({
  channel: z.enum(["whatsapp_group", "whatsapp_individual", "copy", "native_share"]),
  kind: z.enum(["share", "reminder"]).default("share"),
  member_id: z.string().uuid().optional().nullable(),
});
