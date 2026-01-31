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
// EXAMS TABLE (Ujian Tahfidz)
// ============================================
export const exams = sqliteTable("exams", {
  id: text("id")
    .primaryKey()
    .$defaultFn((): string => uuidv4()),
  name: text("name").notNull(), // e.g., "Ujian Tengah Semester 1", "Ujian Akhir Tahun"
  description: text("description"),
  examType: text("exam_type", {
    enum: ["mid_semester", "end_semester", "monthly", "weekly", "placement"],
  }).notNull(),
  classId: text("class_id").references(() => classes.id, {
    onDelete: "set null",
  }),
  surahId: integer("surah_id").references(() => surahs.id), // Optional: specific surah for exam
  startSurah: integer("start_surah").references(() => surahs.id), // Range start
  endSurah: integer("end_surah").references(() => surahs.id), // Range end
  startAyah: integer("start_ayah"),
  endAyah: integer("end_ayah"),
  examDate: text("exam_date").notNull(), // YYYY-MM-DD
  academicYear: text("academic_year").notNull(), // e.g., "2025/2026"
  semester: text("semester", { enum: ["1", "2"] }).notNull(),
  passingScore: real("passing_score").notNull().default(70),
  maxScore: real("max_score").notNull().default(100),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================
// EXAM RESULTS TABLE (Hasil Ujian)
// ============================================
export const examResults = sqliteTable("exam_results", {
  id: text("id")
    .primaryKey()
    .$defaultFn((): string => uuidv4()),
  examId: text("exam_id")
    .notNull()
    .references(() => exams.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Hafalan scores
  hafalanScore: real("hafalan_score").notNull().default(0), // 0-100
  tajwidScore: real("tajwid_score").notNull().default(0), // 0-100
  fashohahScore: real("fashohah_score").notNull().default(0), // 0-100
  fluencyScore: real("fluency_score").notNull().default(0), // 0-100

  // Additional scores for comprehensive exam
  makhorijulHurufScore: real("makhorijul_huruf_score"), // 0-100
  tartilScore: real("tartil_score"), // 0-100

  // Calculated
  totalScore: real("total_score").notNull().default(0),
  grade: text("grade", { enum: ["A", "B", "C", "D", "E"] }),
  isPassed: integer("is_passed", { mode: "boolean" }).notNull().default(false),
  rank: integer("rank"), // Rank in class

  // Examiner info
  examinerId: text("examiner_id").references(() => users.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  feedback: text("feedback"), // Detailed feedback for student

  examTakenAt: text("exam_taken_at")
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
// REPORTS TABLE (Raport/Report Cards)
// ============================================
export const reports = sqliteTable("reports", {
  id: text("id")
    .primaryKey()
    .$defaultFn((): string => uuidv4()),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  classId: text("class_id").references(() => classes.id, {
    onDelete: "set null",
  }),
  academicYear: text("academic_year").notNull(), // e.g., "2025/2026"
  semester: text("semester", { enum: ["1", "2"] }).notNull(),

  // Attendance Summary
  totalSessions: integer("total_sessions").notNull().default(0),
  presentCount: integer("present_count").notNull().default(0),
  absentCount: integer("absent_count").notNull().default(0),
  sickCount: integer("sick_count").notNull().default(0),
  leaveCount: integer("leave_count").notNull().default(0),
  attendancePercentage: real("attendance_percentage").notNull().default(0),

  // Tahfidz Progress
  totalAyahsMemorized: integer("total_ayahs_memorized").notNull().default(0),
  totalNewAyahs: integer("total_new_ayahs").notNull().default(0), // This semester
  totalMurojaahSessions: integer("total_murojaah_sessions")
    .notNull()
    .default(0),
  currentSurah: integer("current_surah").references(() => surahs.id), // Last surah memorized
  currentAyah: integer("current_ayah"),
  targetAyahs: integer("target_ayahs"), // Target for the semester
  progressPercentage: real("progress_percentage").notNull().default(0),

  // Average Scores (from daily assessments)
  avgTajwidScore: real("avg_tajwid_score").notNull().default(0),
  avgFashohahScore: real("avg_fashohah_score").notNull().default(0),
  avgFluencyScore: real("avg_fluency_score").notNull().default(0),
  avgTotalScore: real("avg_total_score").notNull().default(0),

  // Exam Scores (from exams)
  midSemesterScore: real("mid_semester_score"),
  endSemesterScore: real("end_semester_score"),
  finalScore: real("final_score").notNull().default(0),
  finalGrade: text("final_grade", { enum: ["A", "B", "C", "D", "E"] }),

  // Ranking
  classRank: integer("class_rank"),
  totalStudents: integer("total_students"),

  // Status
  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),

  // Comments
  teacherNotes: text("teacher_notes"),
  principalNotes: text("principal_notes"),
  recommendations: text("recommendations"),

  // Approval
  approvedBy: text("approved_by").references(() => users.id, {
    onDelete: "set null",
  }),
  approvedAt: text("approved_at"),

  publishedAt: text("published_at"),
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
    .$defaultFn((): string => uuidv4()),
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

export type Exam = typeof exams.$inferSelect;
export type NewExam = typeof exams.$inferInsert;

export type ExamResult = typeof examResults.$inferSelect;
export type NewExamResult = typeof examResults.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;

// Role Types
export type UserRole = "admin" | "teacher" | "student" | "parent";
export type SessionType = "subuh" | "ziyadah" | "murojaah" | "tahsin";
export type AttendanceStatus = "present" | "absent" | "sick" | "leave" | "late";
export type MemorizationType = "ziyadah" | "murojaah";
export type Grade = "A" | "B" | "C" | "D" | "E";
export type ExamType =
  | "mid_semester"
  | "end_semester"
  | "monthly"
  | "weekly"
  | "placement";
export type ReportStatus = "draft" | "published" | "archived";
