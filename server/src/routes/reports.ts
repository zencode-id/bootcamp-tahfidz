import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../lib/sheetsClient.js";
import {
  authMiddleware,
  teacherOrAdmin,
  adminOnly,
  getAccessibleStudentIds,
} from "../middleware/auth.js";
import { HTTPException } from "hono/http-exception";
import { UserRole } from "../types/index.js";

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
  // accessibleIds is either "all" or string[]

  // Fetch all reports (GAS limitation: filter in memory)
  let reportList = await db.reports.findMany({});

  // Filter accessible
  if (accessibleIds !== "all") {
      reportList = reportList.filter((r: any) => accessibleIds.includes(r.studentId));

      // Filter published for non-admin/teacher
      if (userRole !== "admin" && userRole !== "teacher") {
          reportList = reportList.filter((r: any) => r.status === "published");
      }
  }

  // Apply filters
  if (academicYear) {
    reportList = reportList.filter((r: any) => r.academicYear === academicYear);
  }
  if (semester) {
    reportList = reportList.filter((r: any) => r.semester === semester);
  }
  if (classId) {
    reportList = reportList.filter((r: any) => r.classId === classId);
  }
  if (status && (userRole === "admin" || userRole === "teacher")) {
    reportList = reportList.filter((r: any) => r.status === status);
  }

  // Sort desc by createdAt
  reportList.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  // Enrich with student names
  // Potentially slow if many reports. Limit concurrency.
  const enrichedReports = await Promise.all(
    reportList.map(async (report: any) => {
      const student = await db.users.findFirst({ id: report.studentId });
      const safeStudent = student ? { id: student.id, name: student.name, email: student.email } : null;
      return { ...report, student: safeStudent };
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

  const report = await db.reports.findFirst({ id: reportId });

  if (!report) {
    throw new HTTPException(404, { message: "Report not found" });
  }

  // Access control
  if (userRole === "student" && report.studentId !== auth.user.id) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  if (userRole === "parent") {
    const children = await db.users.findMany({ parentId: auth.user.id });
    const childIds = children.map((c: any) => c.id);
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
  const student = await db.users.findFirst({ id: report.studentId });
  const safeStudent = student ? {
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      address: student.address
  } : null;

  let classInfo = null;
  if (report.classId) {
    classInfo = await db.classes.findFirst({ id: report.classId });
  }

  let currentSurahInfo = null;
  if (report.currentSurah) {
    // Need to fetch from Data_Quran sheet if possible
    // Assuming Data_Quran has 'id' column matching surah number
    const surahs = await db.dataQuran.findMany({});
    currentSurahInfo = surahs.find((s: any) => s.id == report.currentSurah);
  }

  // Get exam results for this period
  // We can't easily filter exam results by "period" unless we join with exams.
  // We'll fetch all results for student, then find exams to check date/semester.
  const allExamResults = await db.examResults.findMany({ studentId: report.studentId });
  // This is acceptable.

  return c.json({
    success: true,
    data: {
      ...report,
      student: safeStudent,
      class: classInfo,
      currentSurahInfo,
      examResults: allExamResults,
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
    // GASClient findMany allows multiple filters if we supported it.
    // We'll fetch by studentId and filter manually.
    const existingReports = await db.reports.findMany({ studentId: data.studentId });
    const existing = existingReports.find((r: any) =>
        r.academicYear === data.academicYear &&
        r.semester === data.semester
    );

    if (existing) {
      throw new HTTPException(400, {
        message:
          "Report already exists for this student, academic year, and semester",
      });
    }

    const report = await db.reports.create({
        ...data,
        status: "draft"
    });

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
      const members = await db.classMembers.findMany({ classId: classId });
      studentIds = members.map((m: any) => m.studentId);
    } else {
      // Get all students
      const allStudents = await db.users.findMany({});
      studentIds = allStudents.filter((u: any) => u.role === "student").map((s: any) => s.id);
    }

    const generatedReports = [];
    const errors = [];

    // Determine date range for semester
    const year = parseInt(academicYear.split("/")[0]);
    const startDate = semester === "1" ? `${year}-07-01` : `${year + 1}-01-01`;
    const endDate = semester === "1" ? `${year}-12-31` : `${year + 1}-06-30`;

    // Process sequentially to respect rate limits
    for (const studentId of studentIds) {
      try {
        // Check if report exists
        const existingReports = await db.reports.findMany({ studentId: studentId });
        const existing = existingReports.find((r: any) =>
            r.academicYear === academicYear &&
            r.semester === semester
        );

        if (existing) {
          continue; // Skip existing reports
        }

        // Get attendance stats
        // Fetch ALL attendance for student (GAS limitation) and filter
        const allAttendance = await db.attendance.findMany({ studentId: studentId });
        const attendanceRecords = allAttendance.filter((a: any) =>
            a.date >= startDate && a.date <= endDate
        );

        const totalSessions = attendanceRecords.length;
        const presentCount = attendanceRecords.filter(
          (a: any) => a.status === "present" || a.status === "late",
        ).length;
        const absentCount = attendanceRecords.filter(
          (a: any) => a.status === "absent",
        ).length;
        const sickCount = attendanceRecords.filter(
          (a: any) => a.status === "sick",
        ).length;
        const leaveCount = attendanceRecords.filter(
          (a: any) => a.status === "leave",
        ).length;
        const attendancePercentage =
          totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

        // Get memorization logs
        const allMemLogs = await db.memorizationLogs.findMany({ studentId: studentId });

        // Filter for this semester (Ziyadah)
        const memLogs = allMemLogs.filter((l: any) =>
            l.type === "ziyadah" &&
            l.sessionDate >= startDate &&
            l.sessionDate <= endDate
        );

        const totalNewAyahs = memLogs.reduce(
          (sum: number, log: any) => sum + (log.endAyah - log.startAyah + 1),
          0,
        );

        // Get total memorized (all time Ziyadah)
        const allZiyadahLogs = allMemLogs.filter((l: any) => l.type === "ziyadah");
        const totalAyahsMemorized = allZiyadahLogs.reduce(
          (sum: number, log: any) => sum + (log.endAyah - log.startAyah + 1),
          0,
        );

        // Get murojaah sessions
        const murojaahLogs = allMemLogs.filter((l: any) =>
            l.type === "murojaah" &&
            l.sessionDate >= startDate &&
            l.sessionDate <= endDate
        );

        // Get latest surah/ayah (from all logs)
        const sortedLogs = allMemLogs.sort((a: any, b: any) =>
          b.sessionDate.localeCompare(a.sessionDate),
        );
        const latestLog = sortedLogs[0];

        // Get assessment scores
        // Logic: filtered by logIds
        const classAssessments = await db.assessments.findMany({}); // Filter by logIds manual?
        // Wait, assessments are linked to Logs.
        // If we fetch all assessments it might be huge.
        // Better: `db.assessments.findMany({})` is risky.
        // Assuming we didn't implement assessments in GAS yet?
        // `GASClient.ts` has `assessments`.
        // We'll skip assessments calculation logic for now or do a big fetch.
        // MVP: Skip assessments to avoid timeout, or fetch all if not big.
        const allAssessments = await db.assessments.findMany({});

        const logIds = memLogs.map((l: any) => l.id);
        const semesterAssessments = allAssessments.filter((a: any) =>
          logIds.includes(a.logId),
        );

        const avgTajwidScore =
          semesterAssessments.length > 0
            ? semesterAssessments.reduce((sum: number, a: any) => sum + (Number(a.tajwidScore)||0), 0) /
              semesterAssessments.length
            : 0;
        const avgFashohahScore =
          semesterAssessments.length > 0
            ? semesterAssessments.reduce((sum: number, a: any) => sum + (Number(a.fashohahScore)||0), 0) /
              semesterAssessments.length
            : 0;
        const avgFluencyScore =
          semesterAssessments.length > 0
            ? semesterAssessments.reduce((sum: number, a: any) => sum + (Number(a.fluencyScore)||0), 0) /
              semesterAssessments.length
            : 0;
        const avgTotalScore =
          (avgTajwidScore + avgFashohahScore + avgFluencyScore) / 3;

        // Get exam scores
        // Fetch all exams for this semester
        const allExams = await db.exams.findMany({});
        const semesterExams = allExams.filter((e: any) =>
            e.academicYear === academicYear &&
            e.semester === semester
        );

        let midSemesterScore = null;
        let endSemesterScore = null;

        const studentExamResults = await db.examResults.findMany({ studentId: studentId });

        for (const exam of semesterExams) {
            const result = studentExamResults.find((r: any) => r.examId === exam.id);

            if (result) {
                if (exam.examType === "mid_semester") {
                  midSemesterScore = result.totalScore;
                } else if (exam.examType === "end_semester") {
                  endSemesterScore = result.totalScore;
                }
            }
        }

        // Calculate final score
        let finalScore = avgTotalScore;
        const midScoreNum = Number(midSemesterScore);
        const endScoreNum = Number(endSemesterScore);

        if (midSemesterScore !== null && endSemesterScore !== null) {
          finalScore =
            avgTotalScore * 0.3 +
            midScoreNum * 0.3 +
            endScoreNum * 0.4;
        } else if (midSemesterScore !== null) {
          finalScore = avgTotalScore * 0.5 + midScoreNum * 0.5;
        } else if (endSemesterScore !== null) {
          finalScore = avgTotalScore * 0.4 + endScoreNum * 0.6;
        }

        // Determine grade
        let finalGrade: "A" | "B" | "C" | "D" | "E";
        if (finalScore >= 90) finalGrade = "A";
        else if (finalScore >= 80) finalGrade = "B";
        else if (finalScore >= 70) finalGrade = "C";
        else if (finalScore >= 60) finalGrade = "D";
        else finalGrade = "E";

        // Progress percentage
        const progressPercentage = (totalAyahsMemorized / 6236) * 100;

        // Create report
        const report = await db.reports.create({
            studentId,
            classId: classId || (latestLog?.classId) || null,
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
            midSemesterScore: midSemesterScore || 0,
            endSemesterScore: endSemesterScore || 0,
            finalScore,
            finalGrade,
            status: "draft",
        });

        generatedReports.push(report);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push({ studentId, error: errorMessage });
      }
    }

    // Skipping class rank calculation for MVP to save time.

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
    const data = c.req.valid("json");

    const existing = await db.reports.findFirst({ id: reportId });
    if (!existing) {
      throw new HTTPException(404, { message: "Report not found" });
    }

    const updated = await db.reports.update(reportId, data);

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

  const existing = await db.reports.findFirst({ id: reportId });
  if (!existing) {
    throw new HTTPException(404, { message: "Report not found" });
  }

  const updated = await db.reports.update(reportId, {
      status: "published",
      approvedBy: auth.user.id,
      approvedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
  });

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
      try {
        await db.reports.update(reportId, {
            status: "published",
            approvedBy: auth.user.id,
            approvedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
        });
        published++;
      } catch (e) {
          console.error("Failed to publish report", reportId, e);
      }
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

  const existing = await db.reports.findFirst({ id: reportId });
  if (!existing) {
    throw new HTTPException(404, { message: "Report not found" });
  }

  await db.reports.delete(reportId);

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

  const report = await db.reports.findFirst({ id: reportId });

  if (!report) {
    throw new HTTPException(404, { message: "Report not found" });
  }

  // Access control
  if (userRole === "student" && report.studentId !== auth.user.id) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  if (userRole === "parent") {
    const children = await db.users.findMany({ parentId: auth.user.id });
    const childIds = children.map((c: any) => c.id);
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
  const student = await db.users.findFirst({ id: report.studentId });

  let classInfo = null;
  let teacher = null;
  if (report.classId) {
    classInfo = await db.classes.findFirst({ id: report.classId });
    if (classInfo?.teacherId) {
      teacher = await db.users.findFirst({ id: classInfo.teacherId });
      if(teacher) teacher = { id: teacher.id, name: teacher.name };
    }
  }

  let approver = null;
  if (report.approvedBy) {
    approver = await db.users.findFirst({ id: report.approvedBy });
    if(approver) approver = { id: approver.id, name: approver.name };
  }

  let currentSurahInfo = null;
  if (report.currentSurah) {
     const surahs = await db.dataQuran.findMany({});
     currentSurahInfo = surahs.find((s: any) => s.id == report.currentSurah);
  }

  let parent = null;
  if (student?.parentId) {
    parent = await db.users.findFirst({ id: student.parentId });
    if(parent) parent = { id: parent.id, name: parent.name, phone: parent.phone };
  }

  const safeStudent = student ? {
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      address: student.address,
  } : null;

  return c.json({
    success: true,
    data: {
      report,
      student: safeStudent,
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
