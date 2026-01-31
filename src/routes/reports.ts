import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  reports,
  users,
  classes,
  attendance,
  memorizationLogs,
  assessments,
  examResults,
  exams,
  surahs,
  classMembers,
} from "../db/schema.js";
import { eq, and, desc, gte, lte, sql, count } from "drizzle-orm";
import {
  authMiddleware,
  teacherOrAdmin,
  adminOnly,
  getAccessibleStudentIds,
} from "../middleware/auth.js";
import { HTTPException } from "hono/http-exception";
import type { UserRole } from "../db/schema.js";

const reportRoutes = new Hono();

// Apply auth middleware to all routes
reportRoutes.use("*", authMiddleware);

// ============================================
// VALIDATION SCHEMAS
// ============================================
const createReportSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/),
  semester: z.enum(["1", "2"]),
  targetAyahs: z.number().int().optional(),
  teacherNotes: z.string().optional(),
  recommendations: z.string().optional(),
});

const updateReportSchema = createReportSchema.partial().extend({
  principalNotes: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

const generateReportSchema = z.object({
  classId: z.string().uuid().optional(),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/),
  semester: z.enum(["1", "2"]),
  studentIds: z.array(z.string().uuid()).optional(), // If not provided, generate for all students in class
});

// ============================================
// REPORT ROUTES
// ============================================

// GET /reports - List reports
reportRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const userRole = auth.user.role as UserRole;
  const { academicYear, semester, classId, status } = c.req.query();

  const accessibleIds = await getAccessibleStudentIds(auth);

  let reportList;

  if (accessibleIds === "all") {
    // Admin/Teacher can see all
    reportList = await db.query.reports.findMany({
      orderBy: [desc(reports.createdAt)],
    });
  } else {
    // Students/Parents can only see their accessible reports
    reportList = await db.query.reports.findMany({
      orderBy: [desc(reports.createdAt)],
    });
    reportList = reportList.filter((r) => accessibleIds.includes(r.studentId));

    // Filter to only show published reports for non-admin/teacher
    if (userRole !== "admin" && userRole !== "teacher") {
      reportList = reportList.filter((r) => r.status === "published");
    }
  }

  // Apply filters
  if (academicYear) {
    reportList = reportList.filter((r) => r.academicYear === academicYear);
  }
  if (semester) {
    reportList = reportList.filter((r) => r.semester === semester);
  }
  if (classId) {
    reportList = reportList.filter((r) => r.classId === classId);
  }
  if (status && (userRole === "admin" || userRole === "teacher")) {
    reportList = reportList.filter((r) => r.status === status);
  }

  // Enrich with student names
  const enrichedReports = await Promise.all(
    reportList.map(async (report) => {
      const student = await db.query.users.findFirst({
        where: eq(users.id, report.studentId),
        columns: { id: true, name: true, email: true },
      });
      return { ...report, student };
    }),
  );

  return c.json({
    success: true,
    data: enrichedReports,
    total: enrichedReports.length,
  });
});

// GET /reports/:id - Get report details
reportRoutes.get("/:id", async (c) => {
  const reportId = c.req.param("id");
  const auth = c.get("auth");
  const userRole = auth.user.role as UserRole;

  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
  });

  if (!report) {
    throw new HTTPException(404, { message: "Report not found" });
  }

  // Access control
  if (userRole === "student" && report.studentId !== auth.user.id) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  if (userRole === "parent") {
    const children = await db.query.users.findMany({
      where: eq(users.parentId, auth.user.id),
    });
    const childIds = children.map((c) => c.id);
    if (!childIds.includes(report.studentId)) {
      throw new HTTPException(403, { message: "Access denied" });
    }
  }

  // Non-admin/teacher can only see published reports
  if (
    userRole !== "admin" &&
    userRole !== "teacher" &&
    report.status !== "published"
  ) {
    throw new HTTPException(403, { message: "Report not yet published" });
  }

  // Get related data
  const student = await db.query.users.findFirst({
    where: eq(users.id, report.studentId),
    columns: { id: true, name: true, email: true, phone: true, address: true },
  });

  let classInfo = null;
  if (report.classId) {
    classInfo = await db.query.classes.findFirst({
      where: eq(classes.id, report.classId),
    });
  }

  let currentSurahInfo = null;
  if (report.currentSurah) {
    currentSurahInfo = await db.query.surahs.findFirst({
      where: eq(surahs.id, report.currentSurah),
    });
  }

  // Get exam results for this period
  const examResultsList = await db.query.examResults.findMany({
    where: eq(examResults.studentId, report.studentId),
  });

  return c.json({
    success: true,
    data: {
      ...report,
      student,
      class: classInfo,
      currentSurahInfo,
      examResults: examResultsList,
    },
  });
});

// POST /reports - Create report manually
reportRoutes.post(
  "/",
  teacherOrAdmin,
  zValidator("json", createReportSchema),
  async (c) => {
    const auth = c.get("auth");
    const data = c.req.valid("json");

    // Check if report already exists
    const existing = await db.query.reports.findFirst({
      where: and(
        eq(reports.studentId, data.studentId),
        eq(reports.academicYear, data.academicYear),
        eq(reports.semester, data.semester),
      ),
    });

    if (existing) {
      throw new HTTPException(400, {
        message:
          "Report already exists for this student, academic year, and semester",
      });
    }

    const [report] = await db
      .insert(reports)
      .values({
        ...data,
      })
      .returning();

    return c.json(
      {
        success: true,
        message: "Report created successfully",
        data: report,
      },
      201,
    );
  },
);

// POST /reports/generate - Auto-generate reports
reportRoutes.post(
  "/generate",
  teacherOrAdmin,
  zValidator("json", generateReportSchema),
  async (c) => {
    const auth = c.get("auth");
    const {
      classId,
      academicYear,
      semester,
      studentIds: providedStudentIds,
    } = c.req.valid("json");

    // Get student IDs to generate reports for
    let studentIds: string[] = [];

    if (providedStudentIds && providedStudentIds.length > 0) {
      studentIds = providedStudentIds;
    } else if (classId) {
      // Get all students in the class
      const members = await db.query.classMembers.findMany({
        where: eq(classMembers.classId, classId),
      });
      studentIds = members.map((m) => m.studentId);
    } else {
      // Get all students
      const allStudents = await db.query.users.findMany({
        where: eq(users.role, "student"),
      });
      studentIds = allStudents.map((s) => s.id);
    }

    const generatedReports = [];
    const errors = [];

    // Determine date range for semester
    const year = parseInt(academicYear.split("/")[0]);
    const startDate = semester === "1" ? `${year}-07-01` : `${year + 1}-01-01`;
    const endDate = semester === "1" ? `${year}-12-31` : `${year + 1}-06-30`;

    for (const studentId of studentIds) {
      try {
        // Check if report exists
        const existing = await db.query.reports.findFirst({
          where: and(
            eq(reports.studentId, studentId),
            eq(reports.academicYear, academicYear),
            eq(reports.semester, semester),
          ),
        });

        if (existing) {
          continue; // Skip existing reports
        }

        // Get attendance stats
        const attendanceRecords = await db.query.attendance.findMany({
          where: and(
            eq(attendance.studentId, studentId),
            gte(attendance.date, startDate),
            lte(attendance.date, endDate),
          ),
        });

        const totalSessions = attendanceRecords.length;
        const presentCount = attendanceRecords.filter(
          (a) => a.status === "present" || a.status === "late",
        ).length;
        const absentCount = attendanceRecords.filter(
          (a) => a.status === "absent",
        ).length;
        const sickCount = attendanceRecords.filter(
          (a) => a.status === "sick",
        ).length;
        const leaveCount = attendanceRecords.filter(
          (a) => a.status === "leave",
        ).length;
        const attendancePercentage =
          totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

        // Get memorization logs
        const memLogs = await db.query.memorizationLogs.findMany({
          where: and(
            eq(memorizationLogs.studentId, studentId),
            eq(memorizationLogs.type, "ziyadah"),
            gte(memorizationLogs.sessionDate, startDate),
            lte(memorizationLogs.sessionDate, endDate),
          ),
        });

        const totalNewAyahs = memLogs.reduce(
          (sum, log) => sum + (log.endAyah - log.startAyah + 1),
          0,
        );

        // Get total memorized (all time)
        const allMemLogs = await db.query.memorizationLogs.findMany({
          where: and(
            eq(memorizationLogs.studentId, studentId),
            eq(memorizationLogs.type, "ziyadah"),
          ),
        });
        const totalAyahsMemorized = allMemLogs.reduce(
          (sum, log) => sum + (log.endAyah - log.startAyah + 1),
          0,
        );

        // Get murojaah sessions
        const murojaahLogs = await db.query.memorizationLogs.findMany({
          where: and(
            eq(memorizationLogs.studentId, studentId),
            eq(memorizationLogs.type, "murojaah"),
            gte(memorizationLogs.sessionDate, startDate),
            lte(memorizationLogs.sessionDate, endDate),
          ),
        });

        // Get latest surah/ayah
        const latestLog = allMemLogs.sort((a, b) =>
          b.sessionDate.localeCompare(a.sessionDate),
        )[0];

        // Get assessment scores
        const allAssessments = await db.query.assessments.findMany();
        const logIds = memLogs.map((l) => l.id);
        const semesterAssessments = allAssessments.filter((a) =>
          logIds.includes(a.logId),
        );

        const avgTajwidScore =
          semesterAssessments.length > 0
            ? semesterAssessments.reduce((sum, a) => sum + a.tajwidScore, 0) /
              semesterAssessments.length
            : 0;
        const avgFashohahScore =
          semesterAssessments.length > 0
            ? semesterAssessments.reduce((sum, a) => sum + a.fashohahScore, 0) /
              semesterAssessments.length
            : 0;
        const avgFluencyScore =
          semesterAssessments.length > 0
            ? semesterAssessments.reduce((sum, a) => sum + a.fluencyScore, 0) /
              semesterAssessments.length
            : 0;
        const avgTotalScore =
          (avgTajwidScore + avgFashohahScore + avgFluencyScore) / 3;

        // Get exam scores
        const semesterExams = await db.query.exams.findMany({
          where: and(
            eq(exams.academicYear, academicYear),
            eq(exams.semester, semester),
          ),
        });

        let midSemesterScore = null;
        let endSemesterScore = null;

        for (const exam of semesterExams) {
          const result = await db.query.examResults.findFirst({
            where: and(
              eq(examResults.examId, exam.id),
              eq(examResults.studentId, studentId),
            ),
          });
          if (result) {
            if (exam.examType === "mid_semester") {
              midSemesterScore = result.totalScore;
            } else if (exam.examType === "end_semester") {
              endSemesterScore = result.totalScore;
            }
          }
        }

        // Calculate final score (weighted: 30% daily, 30% mid, 40% end)
        let finalScore = avgTotalScore;
        if (midSemesterScore !== null && endSemesterScore !== null) {
          finalScore =
            avgTotalScore * 0.3 +
            midSemesterScore * 0.3 +
            endSemesterScore * 0.4;
        } else if (midSemesterScore !== null) {
          finalScore = avgTotalScore * 0.5 + midSemesterScore * 0.5;
        } else if (endSemesterScore !== null) {
          finalScore = avgTotalScore * 0.4 + endSemesterScore * 0.6;
        }

        // Determine grade
        let finalGrade: "A" | "B" | "C" | "D" | "E";
        if (finalScore >= 90) finalGrade = "A";
        else if (finalScore >= 80) finalGrade = "B";
        else if (finalScore >= 70) finalGrade = "C";
        else if (finalScore >= 60) finalGrade = "D";
        else finalGrade = "E";

        // Progress percentage (assuming target is 6236 ayahs = whole Quran)
        const progressPercentage = (totalAyahsMemorized / 6236) * 100;

        // Create report
        const [report] = await db
          .insert(reports)
          .values({
            studentId,
            classId: classId || null,
            academicYear,
            semester,
            totalSessions,
            presentCount,
            absentCount,
            sickCount,
            leaveCount,
            attendancePercentage,
            totalAyahsMemorized,
            totalNewAyahs,
            totalMurojaahSessions: murojaahLogs.length,
            currentSurah: latestLog?.surahId || null,
            currentAyah: latestLog?.endAyah || null,
            progressPercentage,
            avgTajwidScore,
            avgFashohahScore,
            avgFluencyScore,
            avgTotalScore,
            midSemesterScore,
            endSemesterScore,
            finalScore,
            finalGrade,
            status: "draft",
          })
          .returning();

        generatedReports.push(report);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push({ studentId, error: errorMessage });
      }
    }

    // Calculate rankings within class
    if (classId && generatedReports.length > 0) {
      const classReports = await db.query.reports.findMany({
        where: and(
          eq(reports.classId, classId),
          eq(reports.academicYear, academicYear),
          eq(reports.semester, semester),
        ),
        orderBy: [desc(reports.finalScore)],
      });

      for (let i = 0; i < classReports.length; i++) {
        await db
          .update(reports)
          .set({
            classRank: i + 1,
            totalStudents: classReports.length,
          })
          .where(eq(reports.id, classReports[i].id));
      }
    }

    return c.json({
      success: true,
      message: `Generated ${generatedReports.length} reports`,
      data: {
        generated: generatedReports.length,
        skipped: studentIds.length - generatedReports.length - errors.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  },
);

// PUT /reports/:id - Update report
reportRoutes.put(
  "/:id",
  teacherOrAdmin,
  zValidator("json", updateReportSchema),
  async (c) => {
    const reportId = c.req.param("id");
    const auth = c.get("auth");
    const data = c.req.valid("json");

    const [updated] = await db
      .update(reports)
      .set({
        ...data,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(reports.id, reportId))
      .returning();

    if (!updated) {
      throw new HTTPException(404, { message: "Report not found" });
    }

    return c.json({
      success: true,
      message: "Report updated successfully",
      data: updated,
    });
  },
);

// POST /reports/:id/publish - Publish report
reportRoutes.post("/:id/publish", adminOnly, async (c) => {
  const reportId = c.req.param("id");
  const auth = c.get("auth");

  const [updated] = await db
    .update(reports)
    .set({
      status: "published",
      approvedBy: auth.user.id,
      approvedAt: sql`(datetime('now'))`,
      publishedAt: sql`(datetime('now'))`,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(reports.id, reportId))
    .returning();

  if (!updated) {
    throw new HTTPException(404, { message: "Report not found" });
  }

  return c.json({
    success: true,
    message: "Report published successfully",
    data: updated,
  });
});

// POST /reports/publish-bulk - Publish multiple reports
reportRoutes.post(
  "/publish-bulk",
  adminOnly,
  zValidator("json", z.object({ reportIds: z.array(z.string().uuid()) })),
  async (c) => {
    const auth = c.get("auth");
    const { reportIds } = c.req.valid("json");

    let published = 0;

    for (const reportId of reportIds) {
      const [updated] = await db
        .update(reports)
        .set({
          status: "published",
          approvedBy: auth.user.id,
          approvedAt: sql`(datetime('now'))`,
          publishedAt: sql`(datetime('now'))`,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(reports.id, reportId))
        .returning();

      if (updated) published++;
    }

    return c.json({
      success: true,
      message: `Published ${published} reports`,
      data: { published },
    });
  },
);

// DELETE /reports/:id - Delete report
reportRoutes.delete("/:id", adminOnly, async (c) => {
  const reportId = c.req.param("id");

  const [deleted] = await db
    .delete(reports)
    .where(eq(reports.id, reportId))
    .returning();

  if (!deleted) {
    throw new HTTPException(404, { message: "Report not found" });
  }

  return c.json({
    success: true,
    message: "Report deleted successfully",
  });
});

// GET /reports/:id/print - Get printable report data
reportRoutes.get("/:id/print", async (c) => {
  const reportId = c.req.param("id");
  const auth = c.get("auth");
  const userRole = auth.user.role as UserRole;

  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
  });

  if (!report) {
    throw new HTTPException(404, { message: "Report not found" });
  }

  // Access control
  if (userRole === "student" && report.studentId !== auth.user.id) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  if (userRole === "parent") {
    const children = await db.query.users.findMany({
      where: eq(users.parentId, auth.user.id),
    });
    const childIds = children.map((c) => c.id);
    if (!childIds.includes(report.studentId)) {
      throw new HTTPException(403, { message: "Access denied" });
    }
  }

  if (
    report.status !== "published" &&
    userRole !== "admin" &&
    userRole !== "teacher"
  ) {
    throw new HTTPException(403, { message: "Report not yet published" });
  }

  // Get all related data for printing
  const student = await db.query.users.findFirst({
    where: eq(users.id, report.studentId),
  });

  let classInfo = null;
  let teacher = null;
  if (report.classId) {
    classInfo = await db.query.classes.findFirst({
      where: eq(classes.id, report.classId),
    });
    if (classInfo?.teacherId) {
      teacher = await db.query.users.findFirst({
        where: eq(users.id, classInfo.teacherId),
        columns: { id: true, name: true },
      });
    }
  }

  let approver = null;
  if (report.approvedBy) {
    approver = await db.query.users.findFirst({
      where: eq(users.id, report.approvedBy),
      columns: { id: true, name: true },
    });
  }

  let currentSurahInfo = null;
  if (report.currentSurah) {
    currentSurahInfo = await db.query.surahs.findFirst({
      where: eq(surahs.id, report.currentSurah),
    });
  }

  // Get parent info
  let parent = null;
  if (student?.parentId) {
    parent = await db.query.users.findFirst({
      where: eq(users.id, student.parentId),
      columns: { id: true, name: true, phone: true },
    });
  }

  return c.json({
    success: true,
    data: {
      report,
      student: student
        ? {
            id: student.id,
            name: student.name,
            email: student.email,
            phone: student.phone,
            address: student.address,
          }
        : null,
      parent,
      class: classInfo,
      teacher,
      currentSurah: currentSurahInfo,
      approver,
      printedAt: new Date().toISOString(),
    },
  });
});

export default reportRoutes;
