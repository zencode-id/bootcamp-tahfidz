import {
  sqliteTable,
  text,
  integer,
  real,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// ============================================
// USERS TABLE
// ============================================
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn((): string => uuidv4()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "teacher", "student", "parent"] })
    .notNull()
    .default("student"),
  parentId: text("parent_id").references((): AnySQLiteColumn => users.id, {
    onDelete: "set null",
  }),
  phone: text("phone"),
  address: text("address"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================
// CLASSES/HALAQAH TABLE
// ============================================
export const classes = sqliteTable("classes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  name: text("name").notNull(),
  description: text("description"),
  teacherId: text("teacher_id").references(() => users.id, {
    onDelete: "set null",
  }),
  schedule: text("schedule"), // JSON string for weekly schedule
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================
// CLASS MEMBERS (Students in Classes)
// ============================================
export const classMembers = sqliteTable("class_members", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  enrolledAt: text("enrolled_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================
// SURAHS TABLE (Reference Data)
// ============================================
export const surahs = sqliteTable("surahs", {
  id: integer("id").primaryKey(), // 1-114
  name: text("name").notNull(),
  arabicName: text("arabic_name").notNull(),
  totalAyahs: integer("total_ayahs").notNull(),
  juz: text("juz"), // JSON array of juz numbers this surah spans
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================
// ATTENDANCE TABLE
// ============================================
export const attendance = sqliteTable("attendance", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").references(() => classes.id, {
    onDelete: "set null",
  }),
  sessionType: text("session_type", {
    enum: ["subuh", "ziyadah", "murojaah", "tahsin"],
  }).notNull(),
  status: text("status", {
    enum: ["present", "absent", "sick", "leave", "late"],
  }).notNull(),
  proofUrl: text("proof_url"), // For sick/leave documentation
  notes: text("notes"),
  date: text("date").notNull(), // YYYY-MM-DD format
  recordedBy: text("recorded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  syncedAt: text("synced_at"), // For offline sync tracking
  syncSource: text("sync_source", { enum: ["app", "web", "gsheet"] }).default(
    "app",
  ),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================
// MEMORIZATION LOGS TABLE
// ============================================
export const memorizationLogs = sqliteTable("memorization_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["ziyadah", "murojaah"] }).notNull(),
  surahId: integer("surah_id")
    .notNull()
    .references(() => surahs.id),
  startAyah: integer("start_ayah").notNull(),
  endAyah: integer("end_ayah").notNull(),
  teacherId: text("teacher_id").references(() => users.id, {
    onDelete: "set null",
  }),
  classId: text("class_id").references(() => classes.id, {
    onDelete: "set null",
  }),
  sessionDate: text("session_date").notNull(), // YYYY-MM-DD format
  notes: text("notes"),
  syncedAt: text("synced_at"),
  syncSource: text("sync_source", { enum: ["app", "web", "gsheet"] }).default(
    "app",
  ),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================
// ASSESSMENTS TABLE
// ============================================
export const assessments = sqliteTable("assessments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  logId: text("log_id")
    .notNull()
    .references(() => memorizationLogs.id, { onDelete: "cascade" }),
  tajwidScore: real("tajwid_score").notNull().default(0), // 0-100
  fashohahScore: real("fashohah_score").notNull().default(0), // 0-100
  fluencyScore: real("fluency_score").notNull().default(0), // 0-100
  totalScore: real("total_score").notNull().default(0), // Average of all scores
  grade: text("grade", { enum: ["A", "B", "C", "D", "E"] }),
  notes: text("notes"),
  assessedBy: text("assessed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================
// SYNC LOGS TABLE (For tracking GSheet sync)
// ============================================
export const syncLogs = sqliteTable("sync_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
  payload: text("payload"), // JSON string of the data
  syncStatus: text("sync_status", { enum: ["pending", "synced", "failed"] })
    .notNull()
    .default("pending"),
  syncError: text("sync_error"),
  syncedAt: text("synced_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================
// TYPE EXPORTS
// ============================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;

export type ClassMember = typeof classMembers.$inferSelect;
export type NewClassMember = typeof classMembers.$inferInsert;

export type Surah = typeof surahs.$inferSelect;
export type NewSurah = typeof surahs.$inferInsert;

export type Attendance = typeof attendance.$inferSelect;
export type NewAttendance = typeof attendance.$inferInsert;

export type MemorizationLog = typeof memorizationLogs.$inferSelect;
export type NewMemorizationLog = typeof memorizationLogs.$inferInsert;

export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;

export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;

// Role Types
export type UserRole = "admin" | "teacher" | "student" | "parent";
export type SessionType = "subuh" | "ziyadah" | "murojaah" | "tahsin";
export type AttendanceStatus = "present" | "absent" | "sick" | "leave" | "late";
export type MemorizationType = "ziyadah" | "murojaah";
export type Grade = "A" | "B" | "C" | "D" | "E";
