import { z } from "zod";

// ============================================
// COMMON SCHEMAS
// ============================================
export const uuidSchema = z.string().uuid();
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD");
export const scoreSchema = z.number().min(0).max(100);

// ============================================
// AUTH SCHEMAS
// ============================================
export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z
    .enum(["admin", "teacher", "student", "parent"])
    .optional()
    .default("student"),
  parentId: z.string().uuid().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["admin", "teacher", "student", "parent"]).optional(),
  parentId: z.string().uuid().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================
// CLASS SCHEMAS
// ============================================
export const createClassSchema = z.object({
  name: z.string().min(2, "Class name must be at least 2 characters"),
  description: z.string().optional().nullable(),
  teacherId: z.string().uuid().optional().nullable(),
  schedule: z.string().optional().nullable(), // JSON string
});

export const updateClassSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  teacherId: z.string().uuid().optional().nullable(),
  schedule: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const addClassMemberSchema = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid(),
});

// ============================================
// ATTENDANCE SCHEMAS
// ============================================
export const attendanceItemSchema = z.object({
  id: z.string().uuid().optional(), // Optional for new records, required for sync
  studentId: z.string().uuid(),
  classId: z.string().uuid().optional().nullable(),
  sessionType: z.enum(["subuh", "ziyadah", "murojaah", "tahsin"]),
  status: z.enum(["present", "absent", "sick", "leave", "late"]),
  proofUrl: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  date: dateSchema,
  recordedBy: z.string().uuid().optional().nullable(),
  syncSource: z.enum(["app", "web", "gsheet"]).optional().default("app"),
});

export const bulkAttendanceSchema = z.object({
  items: z
    .array(attendanceItemSchema)
    .min(1, "At least one attendance record required"),
});

export const updateAttendanceSchema = z.object({
  sessionType: z.enum(["subuh", "ziyadah", "murojaah", "tahsin"]).optional(),
  status: z.enum(["present", "absent", "sick", "leave", "late"]).optional(),
  proofUrl: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  date: dateSchema.optional(),
});

// ============================================
// MEMORIZATION LOG SCHEMAS
// ============================================
export const memorizationLogItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    studentId: z.string().uuid(),
    type: z.enum(["ziyadah", "murojaah"]),
    surahId: z.number().int().min(1).max(114),
    startAyah: z.number().int().min(1),
    endAyah: z.number().int().min(1),
    teacherId: z.string().uuid().optional().nullable(),
    classId: z.string().uuid().optional().nullable(),
    sessionDate: dateSchema,
    notes: z.string().optional().nullable(),
    syncSource: z.enum(["app", "web", "gsheet"]).optional().default("app"),
  })
  .refine((data) => data.endAyah >= data.startAyah, {
    message: "End ayah must be greater than or equal to start ayah",
    path: ["endAyah"],
  });

export const assessmentItemSchema = z.object({
  id: z.string().uuid().optional(),
  logId: z.string().uuid(),
  tajwidScore: scoreSchema,
  fashohahScore: scoreSchema,
  fluencyScore: scoreSchema,
  notes: z.string().optional().nullable(),
  assessedBy: z.string().uuid().optional().nullable(),
});

export const bulkTahfidzSchema = z.object({
  logs: z.array(memorizationLogItemSchema).optional().default([]),
  assessments: z.array(assessmentItemSchema).optional().default([]),
});

export const updateMemorizationLogSchema = z.object({
  type: z.enum(["ziyadah", "murojaah"]).optional(),
  surahId: z.number().int().min(1).max(114).optional(),
  startAyah: z.number().int().min(1).optional(),
  endAyah: z.number().int().min(1).optional(),
  teacherId: z.string().uuid().optional().nullable(),
  sessionDate: dateSchema.optional(),
  notes: z.string().optional().nullable(),
});

export const updateAssessmentSchema = z.object({
  tajwidScore: scoreSchema.optional(),
  fashohahScore: scoreSchema.optional(),
  fluencyScore: scoreSchema.optional(),
  notes: z.string().optional().nullable(),
});

// ============================================
// QUERY SCHEMAS
// ============================================
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

export const attendanceQuerySchema = paginationSchema
  .merge(dateRangeSchema)
  .extend({
    studentId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
    sessionType: z.enum(["subuh", "ziyadah", "murojaah", "tahsin"]).optional(),
    status: z.enum(["present", "absent", "sick", "leave", "late"]).optional(),
  });

// ============================================
// TYPE EXPORTS
// ============================================
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type AddClassMemberInput = z.infer<typeof addClassMemberSchema>;

export type AttendanceItemInput = z.infer<typeof attendanceItemSchema>;
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

export type MemorizationLogItemInput = z.infer<
  typeof memorizationLogItemSchema
>;
export type AssessmentItemInput = z.infer<typeof assessmentItemSchema>;
export type BulkTahfidzInput = z.infer<typeof bulkTahfidzSchema>;
export type UpdateMemorizationLogInput = z.infer<
  typeof updateMemorizationLogSchema
>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

export type PaginationInput = z.infer<typeof paginationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type AttendanceQueryInput = z.infer<typeof attendanceQuerySchema>;
