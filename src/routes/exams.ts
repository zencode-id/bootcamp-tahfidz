import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import { exams, examResults, users, classes, surahs } from "../db/schema.js";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import {
  authMiddleware,
  teacherOrAdmin,
  adminOnly,
} from "../middleware/auth.js";
import { HTTPException } from "hono/http-exception";
import type { UserRole } from "../db/schema.js";

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

const bulkExamResultSchema = z.object({
  examId: z.string().uuid(),
  results: z.array(examResultSchema.omit({ examId: true })),
});

// ============================================
// EXAM ROUTES
// ============================================

// GET /exams - List all exams
examRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const userRole = auth.user.role as UserRole;

  let examList;

  if (userRole === "admin") {
    examList = await db.query.exams.findMany({
      orderBy: [desc(exams.examDate)],
    });
  } else if (userRole === "teacher") {
    // Teachers see exams for their classes
    examList = await db.query.exams.findMany({
      where: eq(exams.isActive, true),
      orderBy: [desc(exams.examDate)],
    });
  } else {
    // Students/Parents see only active exams
    examList = await db.query.exams.findMany({
      where: eq(exams.isActive, true),
      orderBy: [desc(exams.examDate)],
    });
  }

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

    const [exam] = await db
      .insert(exams)
      .values({
        ...data,
        createdBy: auth.user.id,
      })
      .returning();

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

  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });

  if (!exam) {
    throw new HTTPException(404, { message: "Exam not found" });
  }

  // Get exam results count
  const resultsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(examResults)
    .where(eq(examResults.examId, examId));

  // Get class info if classId exists
  let classInfo = null;
  if (exam.classId) {
    classInfo = await db.query.classes.findFirst({
      where: eq(classes.id, exam.classId),
    });
  }

  return c.json({
    success: true,
    data: {
      ...exam,
      class: classInfo,
      resultsCount: resultsCount[0]?.count || 0,
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

    const [updated] = await db
      .update(exams)
      .set({
        ...data,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(exams.id, examId))
      .returning();

    if (!updated) {
      throw new HTTPException(404, { message: "Exam not found" });
    }

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

  const [deleted] = await db
    .delete(exams)
    .where(eq(exams.id, examId))
    .returning();

  if (!deleted) {
    throw new HTTPException(404, { message: "Exam not found" });
  }

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
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });

  if (!exam) {
    throw new HTTPException(404, { message: "Exam not found" });
  }

  let results;

  if (userRole === "admin" || userRole === "teacher") {
    results = await db.query.examResults.findMany({
      where: eq(examResults.examId, examId),
      orderBy: [desc(examResults.totalScore)],
    });

    // Enrich with student info
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const student = await db.query.users.findFirst({
          where: eq(users.id, result.studentId),
          columns: { id: true, name: true, email: true },
        });
        return { ...result, student };
      }),
    );

    return c.json({
      success: true,
      data: enrichedResults,
      total: enrichedResults.length,
    });
  } else if (userRole === "student") {
    // Students can only see their own results
    results = await db.query.examResults.findMany({
      where: and(
        eq(examResults.examId, examId),
        eq(examResults.studentId, auth.user.id),
      ),
    });
  } else if (userRole === "parent") {
    // Parents can see their children's results
    const children = await db.query.users.findMany({
      where: eq(users.parentId, auth.user.id),
    });
    const childIds = children.map((c) => c.id);

    results = await db.query.examResults.findMany({
      where: eq(examResults.examId, examId),
    });
    results = results.filter((r) => childIds.includes(r.studentId));
  }

  return c.json({
    success: true,
    data: results,
    total: results?.length || 0,
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
    const exam = await db.query.exams.findFirst({
      where: eq(exams.id, examId),
    });

    if (!exam) {
      throw new HTTPException(404, { message: "Exam not found" });
    }

    // Check if result already exists
    const existing = await db.query.examResults.findFirst({
      where: and(
        eq(examResults.examId, examId),
        eq(examResults.studentId, data.studentId),
      ),
    });

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

    const [result] = await db
      .insert(examResults)
      .values({
        examId,
        ...data,
        totalScore,
        grade,
        isPassed,
        examinerId: auth.user.id,
      })
      .returning();

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

    // Check exam exists
    const exam = await db.query.exams.findFirst({
      where: eq(exams.id, examId),
    });

    if (!exam) {
      throw new HTTPException(404, { message: "Exam not found" });
    }

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

        const [result] = await db
          .insert(examResults)
          .values({
            examId,
            ...item,
            totalScore,
            grade,
            isPassed,
            examinerId: auth.user.id,
          })
          .onConflictDoUpdate({
            target: [examResults.examId, examResults.studentId],
            set: {
              ...item,
              totalScore,
              grade,
              isPassed,
              examinerId: auth.user.id,
              updatedAt: sql`(datetime('now'))`,
            },
          })
          .returning();

        createdResults.push(result);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push({ studentId: item.studentId, error: errorMessage });
      }
    }

    // Calculate ranks
    const allResults = await db.query.examResults.findMany({
      where: eq(examResults.examId, examId),
      orderBy: [desc(examResults.totalScore)],
    });

    for (let i = 0; i < allResults.length; i++) {
      await db
        .update(examResults)
        .set({ rank: i + 1 })
        .where(eq(examResults.id, allResults[i].id));
    }

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
    const children = await db.query.users.findMany({
      where: eq(users.parentId, auth.user.id),
    });
    const childIds = children.map((c) => c.id);
    if (!childIds.includes(studentId)) {
      throw new HTTPException(403, { message: "Access denied" });
    }
  }

  const result = await db.query.examResults.findFirst({
    where: and(
      eq(examResults.examId, examId),
      eq(examResults.studentId, studentId),
    ),
  });

  if (!result) {
    throw new HTTPException(404, { message: "Result not found" });
  }

  // Get exam and student info
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });

  const student = await db.query.users.findFirst({
    where: eq(users.id, studentId),
    columns: { id: true, name: true, email: true },
  });

  return c.json({
    success: true,
    data: {
      ...result,
      exam,
      student,
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

    const existing = await db.query.examResults.findFirst({
      where: and(
        eq(examResults.examId, examId),
        eq(examResults.studentId, studentId),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Result not found" });
    }

    // Recalculate if scores changed
    const scores = [
      data.hafalanScore ?? existing.hafalanScore,
      data.tajwidScore ?? existing.tajwidScore,
      data.fashohahScore ?? existing.fashohahScore,
      data.fluencyScore ?? existing.fluencyScore,
    ];
    if (data.makhorijulHurufScore ?? existing.makhorijulHurufScore)
      scores.push(
        (data.makhorijulHurufScore ?? existing.makhorijulHurufScore) as number,
      );
    if (data.tartilScore ?? existing.tartilScore)
      scores.push((data.tartilScore ?? existing.tartilScore) as number);

    const totalScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    let grade: "A" | "B" | "C" | "D" | "E";
    if (totalScore >= 90) grade = "A";
    else if (totalScore >= 80) grade = "B";
    else if (totalScore >= 70) grade = "C";
    else if (totalScore >= 60) grade = "D";
    else grade = "E";

    const exam = await db.query.exams.findFirst({
      where: eq(exams.id, examId),
    });
    const isPassed = totalScore >= (exam?.passingScore || 70);

    const [updated] = await db
      .update(examResults)
      .set({
        ...data,
        totalScore,
        grade,
        isPassed,
        examinerId: auth.user.id,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(
        and(
          eq(examResults.examId, examId),
          eq(examResults.studentId, studentId),
        ),
      )
      .returning();

    return c.json({
      success: true,
      message: "Result updated successfully",
      data: updated,
    });
  },
);

export default examRoutes;
