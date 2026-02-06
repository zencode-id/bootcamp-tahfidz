import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../lib/gasClient.js";
import {
  authMiddleware,
  teacherOrAdmin,
  adminOnly,
} from "../middleware/auth.js";
import { HTTPException } from "hono/http-exception";
import { UserRole } from "../types/index.js";

const examRoutes = new Hono();

// Apply auth middleware to all routes
examRoutes.use("*", authMiddleware);

// ============================================
// VALIDATION SCHEMAS
// ============================================
const createExamSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  examType: z.enum([
    "mid_semester",
    "end_semester",
    "monthly",
    "weekly",
    "placement",
  ]),
  classId: z.string().uuid().optional(),
  surahId: z.number().int().min(1).max(114).optional(),
  startSurah: z.number().int().min(1).max(114).optional(),
  endSurah: z.number().int().min(1).max(114).optional(),
  startAyah: z.number().int().min(1).optional(),
  endAyah: z.number().int().min(1).optional(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/),
  semester: z.enum(["1", "2"]),
  passingScore: z.number().min(0).max(100).default(70),
  maxScore: z.number().min(1).max(100).default(100),
});

const examResultSchema = z.object({
  examId: z.string().uuid(),
  studentId: z.string().uuid(),
  hafalanScore: z.number().min(0).max(100),
  tajwidScore: z.number().min(0).max(100),
  fashohahScore: z.number().min(0).max(100),
  fluencyScore: z.number().min(0).max(100),
  makhorijulHurufScore: z.number().min(0).max(100).optional(),
  tartilScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  feedback: z.string().optional(),
});

// ============================================
// EXAM ROUTES
// ============================================

// GET /exams - List all exams
examRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const userRole = auth.user.role as UserRole;

  let examList: any[] = [];

  // 1. Fetch all exams (GAS limitation: can't easily filter by isActive OR user specific without fetching)
  // We'll fetch all and filter in memory.
  const allExams = await db.exams.findMany({});

  if (userRole === "admin") {
     examList = allExams;
  } else if (userRole === "teacher") {
    // Teachers see exams for their classes?
    // Logic: Teachers see active exams or exams they created.
    // Original logic: `where: eq(exams.isActive, true)`
    // Teachers should theoretically see inactive exams they created? Original code said "Teachers see exams for their classes" but filtered by `isActive: true`.
    // I'll stick to original logic: Active exams.
    examList = allExams.filter(e => e.isActive === true || e.isActive === "true" || e.isActive === "TRUE");
  } else {
    // Students/Parents see only active exams
    examList = allExams.filter(e => e.isActive === true || e.isActive === "true" || e.isActive === "TRUE");
  }

  // Sort by examDate desc
  examList.sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());

  return c.json({
    success: true,
    data: examList,
    total: examList.length,
  });
});

// POST /exams - Create new exam
examRoutes.post(
  "/",
  teacherOrAdmin,
  zValidator("json", createExamSchema),
  async (c) => {
    const auth = c.get("auth");
    const data = c.req.valid("json");

    const exam = await db.exams.create({
        ...data,
        createdBy: auth.user.id,
        isActive: true
    });

    return c.json(
      {
        success: true,
        message: "Exam created successfully",
        data: exam,
      },
      201,
    );
  },
);

// GET /exams/:id - Get exam details
examRoutes.get("/:id", async (c) => {
  const examId = c.req.param("id");

  const exam = await db.exams.findFirst({
     id: examId
  });

  if (!exam) {
    throw new HTTPException(404, { message: "Exam not found" });
  }

  // Get exam results count
  const allResults = await db.examResults.findMany({ examId: examId });
  const resultsCount = allResults.length;

  // Get class info if classId exists
  let classInfo = null;
  if (exam.classId) {
    classInfo = await db.classes.findFirst({
        id: exam.classId
    });
  }

  return c.json({
    success: true,
    data: {
      ...exam,
      class: classInfo,
      resultsCount: resultsCount,
    },
  });
});

// PUT /exams/:id - Update exam
examRoutes.put(
  "/:id",
  teacherOrAdmin,
  zValidator("json", createExamSchema.partial()),
  async (c) => {
    const examId = c.req.param("id");
    const data = c.req.valid("json");

    // Check exist
    const existing = await db.exams.findFirst({ id: examId });
    if (!existing) {
        throw new HTTPException(404, { message: "Exam not found" });
    }

    const updated = await db.exams.update(examId, data);

    return c.json({
      success: true,
      message: "Exam updated successfully",
      data: updated,
    });
  },
);

// DELETE /exams/:id - Delete exam
examRoutes.delete("/:id", adminOnly, async (c) => {
  const examId = c.req.param("id");

  const existing = await db.exams.findFirst({ id: examId });
  if (!existing) {
        throw new HTTPException(404, { message: "Exam not found" });
   }

  await db.exams.delete(examId);

  return c.json({
    success: true,
    message: "Exam deleted successfully",
  });
});

// ============================================
// EXAM RESULTS ROUTES
// ============================================

// GET /exams/:id/results - Get all results for an exam
examRoutes.get("/:id/results", async (c) => {
  const examId = c.req.param("id");
  const auth = c.get("auth");
  const userRole = auth.user.role as UserRole;

  // Check exam exists
  const exam = await db.exams.findFirst({ id: examId });
  if (!exam) {
    throw new HTTPException(404, { message: "Exam not found" });
  }

  let results: any[] = [];

  // Fetch all results for this exam
  const allResults = await db.examResults.findMany({ examId: examId });

  if (userRole === "admin" || userRole === "teacher") {
    results = allResults;

    // Enrich with student info
    // Fetch all users? No, maybe fetch individually or if cached.
    // Optimization: Fetch all users once (if not too many) or map IDs.
    // For now we'll fetch individually in parallel.
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const student = await db.users.findFirst({
            id: result.studentId
        });
        const safeStudent = student ? { id: student.id, name: student.name, email: student.email } : null;
        return { ...result, student: safeStudent };
      }),
    );

    // Sort by totalScore desc
    enrichedResults.sort((a,b) => (b.totalScore || 0) - (a.totalScore || 0));

    return c.json({
      success: true,
      data: enrichedResults,
      total: enrichedResults.length,
    });

  } else if (userRole === "student") {
    // Students can only see their own results
    results = allResults.filter(r => r.studentId === auth.user.id);
  } else if (userRole === "parent") {
    // Parents can see their children's results
    const children = await db.users.findMany({ parentId: auth.user.id });
    const childIds = children.map((c: any) => c.id);

    results = allResults.filter(r => childIds.includes(r.studentId));
  }

  return c.json({
    success: true,
    data: results,
    total: results.length,
  });
});

// POST /exams/:id/results - Add single result
examRoutes.post(
  "/:id/results",
  teacherOrAdmin,
  zValidator("json", examResultSchema.omit({ examId: true })),
  async (c) => {
    const examId = c.req.param("id");
    const auth = c.get("auth");
    const data = c.req.valid("json");

    // Check exam exists
    const exam = await db.exams.findFirst({ id: examId });
    if (!exam) {
      throw new HTTPException(404, { message: "Exam not found" });
    }

    // Check if result already exists
    // We can use findMany with multiple filters if GASClient supported it fully,
    // or fetch all exam results and filter.
    const results = await db.examResults.findMany({ examId: examId });
    const existing = results.find((r:any) => r.studentId === data.studentId);

    if (existing) {
      throw new HTTPException(400, {
        message: "Result already exists for this student in this exam",
      });
    }

    // Calculate total score
    const scores = [
      data.hafalanScore,
      data.tajwidScore,
      data.fashohahScore,
      data.fluencyScore,
    ];
    if (data.makhorijulHurufScore) scores.push(data.makhorijulHurufScore);
    if (data.tartilScore) scores.push(data.tartilScore);
    const totalScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Determine grade
    let grade: "A" | "B" | "C" | "D" | "E";
    if (totalScore >= 90) grade = "A";
    else if (totalScore >= 80) grade = "B";
    else if (totalScore >= 70) grade = "C";
    else if (totalScore >= 60) grade = "D";
    else grade = "E";

    const isPassed = totalScore >= exam.passingScore;

    const result = await db.examResults.create({
        examId,
        ...data,
        totalScore,
        grade,
        isPassed,
        examinerId: auth.user.id,
    });

    return c.json(
      {
        success: true,
        message: "Exam result created successfully",
        data: result,
      },
      201,
    );
  },
);

// POST /exams/:id/results/bulk - Add bulk results
examRoutes.post(
  "/:id/results/bulk",
  teacherOrAdmin,
  zValidator(
    "json",
    z.object({ results: z.array(examResultSchema.omit({ examId: true })) }),
  ),
  async (c) => {
    const examId = c.req.param("id");
    const auth = c.get("auth");
    const { results: resultItems } = c.req.valid("json");

    const exam = await db.exams.findFirst({ id: examId });
    if (!exam) {
      throw new HTTPException(404, { message: "Exam not found" });
    }

    // Fetch existing results to check for conflicts/updates
    const existingResults = await db.examResults.findMany({ examId: examId });
    const existingMap = new Map();
    existingResults.forEach((r: any) => existingMap.set(r.studentId, r));

    const createdResults = [];
    const errors = [];

    for (const item of resultItems) {
      try {
        // Calculate total score
        const scores = [
          item.hafalanScore,
          item.tajwidScore,
          item.fashohahScore,
          item.fluencyScore,
        ];
        if (item.makhorijulHurufScore) scores.push(item.makhorijulHurufScore);
        if (item.tartilScore) scores.push(item.tartilScore);
        const totalScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        // Determine grade
        let grade: "A" | "B" | "C" | "D" | "E";
        if (totalScore >= 90) grade = "A";
        else if (totalScore >= 80) grade = "B";
        else if (totalScore >= 70) grade = "C";
        else if (totalScore >= 60) grade = "D";
        else grade = "E";

        const isPassed = totalScore >= exam.passingScore;

        const payload = {
            examId,
            ...item,
            totalScore,
            grade,
            isPassed,
            examinerId: auth.user.id,
        };

        const existing = existingMap.get(item.studentId);

        let result;
        if (existing) {
            // Update
            result = await db.examResults.update(existing.id, payload);
        } else {
            // Create
            result = await db.examResults.create(payload);
        }

        createdResults.push(result);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push({ studentId: item.studentId, error: errorMessage });
      }
    }

    // Calculating ranks (Optional step, can be expensive remotely)
    // We'll skip rank persistence for now or do it in a separate background step if needed.
    // GAS script usually isn't fast enough to update 100 rows one by one for rank.

    return c.json({
      success: true,
      message: `Processed ${createdResults.length} results`,
      data: {
        created: createdResults.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  },
);

// GET /exams/:id/results/:studentId - Get specific student result
examRoutes.get("/:id/results/:studentId", async (c) => {
  const examId = c.req.param("id");
  const studentId = c.req.param("studentId");
  const auth = c.get("auth");
  const userRole = auth.user.role as UserRole;

  // Access control
  if (userRole === "student" && studentId !== auth.user.id) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  if (userRole === "parent") {
    const children = await db.users.findMany({ parentId: auth.user.id });
    const childIds = children.map((c: any) => c.id);
    if (!childIds.includes(studentId)) {
      throw new HTTPException(403, { message: "Access denied" });
    }
  }

  // Find result (filter memory)
  const results = await db.examResults.findMany({ examId: examId });
  const result = results.find((r: any) => r.studentId === studentId);

  if (!result) {
    throw new HTTPException(404, { message: "Result not found" });
  }

  const exam = await db.exams.findFirst({ id: examId });
  const student = await db.users.findFirst({ id: studentId });
  const safeStudent = student ? { id: student.id, name: student.name, email: student.email } : null;

  return c.json({
    success: true,
    data: {
      ...result,
      exam,
      student: safeStudent,
    },
  });
});

// PUT /exams/:id/results/:studentId - Update student result
examRoutes.put(
  "/:id/results/:studentId",
  teacherOrAdmin,
  zValidator(
    "json",
    examResultSchema.omit({ examId: true, studentId: true }).partial(),
  ),
  async (c) => {
    const examId = c.req.param("id");
    const studentId = c.req.param("studentId");
    const auth = c.get("auth");
    const data = c.req.valid("json");

    // Find result to get ID
    const results = await db.examResults.findMany({ examId: examId });
    const existing = results.find((r: any) => r.studentId === studentId);

    if (!existing) {
      throw new HTTPException(404, { message: "Result not found" });
    }

    // Recalculate
    const scores = [
      data.hafalanScore ?? existing.hafalanScore,
      data.tajwidScore ?? existing.tajwidScore,
      data.fashohahScore ?? existing.fashohahScore,
      data.fluencyScore ?? existing.fluencyScore,
    ];
    if (data.makhorijulHurufScore ?? existing.makhorijulHurufScore)
      scores.push((data.makhorijulHurufScore ?? existing.makhorijulHurufScore) as number);
    if (data.tartilScore ?? existing.tartilScore)
      scores.push((data.tartilScore ?? existing.tartilScore) as number);

    const totalScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    let grade: "A" | "B" | "C" | "D" | "E";
    if (totalScore >= 90) grade = "A";
    else if (totalScore >= 80) grade = "B";
    else if (totalScore >= 70) grade = "C";
    else if (totalScore >= 60) grade = "D";
    else grade = "E";

    const exam = await db.exams.findFirst({ id: examId });
    const isPassed = totalScore >= (exam?.passingScore || 70);

    const updated = await db.examResults.update(existing.id, {
        ...data,
        totalScore,
        grade,
        isPassed,
        examinerId: auth.user.id,
    });

    return c.json({
      success: true,
      message: "Result updated successfully",
      data: updated,
    });
  },
);

export default examRoutes;
