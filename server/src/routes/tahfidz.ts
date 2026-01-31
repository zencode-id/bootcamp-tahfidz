import { Hono } from "hono";
import { eq, and, sql, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, memorizationLogs, assessments, surahs } from "../db/index.js";
import {
  bulkTahfidzSchema,
  memorizationLogItemSchema,
  assessmentItemSchema,
  updateMemorizationLogSchema,
  updateAssessmentSchema,
  paginationSchema,
  dateRangeSchema,
} from "../validators/index.js";
import {
  authMiddleware,
  teacherOrAdmin,
  canAccessStudent,
  getAccessibleStudentIds,
} from "../middleware/auth.js";
import { syncService } from "../services/sync.js";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

const tahfidz = new Hono();

// Apply auth middleware to all routes
tahfidz.use("*", authMiddleware);

// Helper to calculate grade
function calculateGrade(score: number): "A" | "B" | "C" | "D" | "E" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "E";
}

// ============================================
// POST /sync/tahfidz - Bulk sync memorization logs and assessments
// ============================================
tahfidz.post(
  "/",
  teacherOrAdmin,
  zValidator("json", bulkTahfidzSchema),
  async (c) => {
    const { logs, assessments: assessmentItems } = c.req.valid("json");
    const { user } = c.get("auth");

    const results = {
      logs: {
        created: 0,
        updated: 0,
        errors: [] as { id?: string; error: string }[],
      },
      assessments: {
        created: 0,
        updated: 0,
        errors: [] as { id?: string; error: string }[],
      },
    };

    // Process memorization logs
    for (const log of logs) {
      try {
        const recordId = log.id || uuidv4();

        const existing = log.id
          ? await db.query.memorizationLogs.findFirst({
              where: eq(memorizationLogs.id, log.id),
            })
          : null;

        const logData = {
          id: recordId,
          studentId: log.studentId,
          type: log.type,
          surahId: log.surahId,
          startAyah: log.startAyah,
          endAyah: log.endAyah,
          teacherId: log.teacherId || user.id,
          classId: log.classId || null,
          sessionDate: log.sessionDate,
          notes: log.notes || null,
          syncedAt: new Date().toISOString(),
          syncSource: log.syncSource || "app",
        };

        if (existing) {
          await db
            .update(memorizationLogs)
            .set({ ...logData, updatedAt: new Date().toISOString() })
            .where(eq(memorizationLogs.id, log.id!));

          results.logs.updated++;
          await syncService.queueSync(
            "memorization_logs",
            log.id!,
            "update",
            logData,
          );
        } else {
          await db.insert(memorizationLogs).values(logData);
          results.logs.created++;
          await syncService.queueSync(
            "memorization_logs",
            recordId,
            "create",
            logData,
          );
        }
      } catch (error) {
        results.logs.errors.push({
          id: log.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Process assessments
    for (const assessment of assessmentItems) {
      try {
        const recordId = assessment.id || uuidv4();

        const existing = assessment.id
          ? await db.query.assessments.findFirst({
              where: eq(assessments.id, assessment.id),
            })
          : null;

        const totalScore =
          (assessment.tajwidScore +
            assessment.fashohahScore +
            assessment.fluencyScore) /
          3;

        const assessmentData = {
          id: recordId,
          logId: assessment.logId,
          tajwidScore: assessment.tajwidScore,
          fashohahScore: assessment.fashohahScore,
          fluencyScore: assessment.fluencyScore,
          totalScore,
          grade: calculateGrade(totalScore),
          notes: assessment.notes || null,
          assessedBy: assessment.assessedBy || user.id,
        };

        if (existing) {
          await db
            .update(assessments)
            .set({ ...assessmentData, updatedAt: new Date().toISOString() })
            .where(eq(assessments.id, assessment.id!));

          results.assessments.updated++;
          await syncService.queueSync(
            "assessments",
            assessment.id!,
            "update",
            assessmentData,
          );
        } else {
          await db.insert(assessments).values(assessmentData);
          results.assessments.created++;
          await syncService.queueSync(
            "assessments",
            recordId,
            "create",
            assessmentData,
          );
        }
      } catch (error) {
        results.assessments.errors.push({
          id: assessment.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return c.json({
      success: true,
      message: "Tahfidz data synced successfully",
      data: results,
    });
  },
);

// Query schema for memorization logs
const memorizationQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  studentId: z.string().uuid().optional(),
  type: z.enum(["ziyadah", "murojaah"]).optional(),
  surahId: z.coerce.number().int().min(1).max(114).optional(),
});

// ============================================
// GET /sync/tahfidz/logs - Get memorization logs
// ============================================
tahfidz.get(
  "/logs",
  zValidator("query", memorizationQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const auth = c.get("auth");

    const accessibleIds = await getAccessibleStudentIds(auth);

    const conditions = [];

    if (accessibleIds !== "all") {
      if (accessibleIds.length === 0) {
        return c.json({
          success: true,
          data: [],
          pagination: { page: query.page, limit: query.limit, total: 0 },
        });
      }
      conditions.push(inArray(memorizationLogs.studentId, accessibleIds));
    }

    if (query.studentId) {
      if (accessibleIds !== "all" && !accessibleIds.includes(query.studentId)) {
        throw new HTTPException(403, { message: "Access denied" });
      }
      conditions.push(eq(memorizationLogs.studentId, query.studentId));
    }

    if (query.type) {
      conditions.push(eq(memorizationLogs.type, query.type));
    }

    if (query.surahId) {
      conditions.push(eq(memorizationLogs.surahId, query.surahId));
    }

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(memorizationLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult[0]?.count || 0;
    const offset = (query.page - 1) * query.limit;

    const data = await db.query.memorizationLogs.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      limit: query.limit,
      offset,
      orderBy: (logs, { desc }) => [
        desc(logs.sessionDate),
        desc(logs.createdAt),
      ],
    });

    return c.json({
      success: true,
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  },
);

// ============================================
// GET /sync/tahfidz/logs/:id
// ============================================
tahfidz.get("/logs/:id", async (c) => {
  const { id } = c.req.param();
  const auth = c.get("auth");

  const log = await db.query.memorizationLogs.findFirst({
    where: eq(memorizationLogs.id, id),
  });

  if (!log) {
    throw new HTTPException(404, { message: "Memorization log not found" });
  }

  const hasAccess = await canAccessStudent(auth, log.studentId);
  if (!hasAccess) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  // Get associated assessment if exists
  const assessment = await db.query.assessments.findFirst({
    where: eq(assessments.logId, id),
  });

  return c.json({
    success: true,
    data: {
      ...log,
      assessment,
    },
  });
});

// ============================================
// PUT /sync/tahfidz/logs/:id
// ============================================
tahfidz.put(
  "/logs/:id",
  teacherOrAdmin,
  zValidator("json", memorizationLogItemSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const existing = await db.query.memorizationLogs.findFirst({
      where: eq(memorizationLogs.id, id),
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Memorization log not found" });
    }

    const [updated] = await db
      .update(memorizationLogs)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(memorizationLogs.id, id))
      .returning();

    await syncService.queueSync("memorization_logs", id, "update", body);

    return c.json({
      success: true,
      message: "Memorization log updated",
      data: updated,
    });
  },
);

// ============================================
// PATCH /sync/tahfidz/logs/:id
// ============================================
tahfidz.patch(
  "/logs/:id",
  teacherOrAdmin,
  zValidator("json", updateMemorizationLogSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const existing = await db.query.memorizationLogs.findFirst({
      where: eq(memorizationLogs.id, id),
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Memorization log not found" });
    }

    const [updated] = await db
      .update(memorizationLogs)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(memorizationLogs.id, id))
      .returning();

    await syncService.queueSync("memorization_logs", id, "update", body);

    return c.json({
      success: true,
      message: "Memorization log updated",
      data: updated,
    });
  },
);

// ============================================
// DELETE /sync/tahfidz/logs/:id
// ============================================
tahfidz.delete("/logs/:id", teacherOrAdmin, async (c) => {
  const { id } = c.req.param();

  const existing = await db.query.memorizationLogs.findFirst({
    where: eq(memorizationLogs.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Memorization log not found" });
  }

  // Delete associated assessments first
  await db.delete(assessments).where(eq(assessments.logId, id));
  await db.delete(memorizationLogs).where(eq(memorizationLogs.id, id));

  await syncService.queueSync("memorization_logs", id, "delete", { id });

  return c.json({
    success: true,
    message: "Memorization log deleted",
  });
});

// ============================================
// ASSESSMENT ROUTES
// ============================================

// POST /sync/tahfidz/assessments
tahfidz.post(
  "/assessments",
  teacherOrAdmin,
  zValidator("json", assessmentItemSchema),
  async (c) => {
    const body = c.req.valid("json");
    const { user } = c.get("auth");

    // Check if log exists
    const log = await db.query.memorizationLogs.findFirst({
      where: eq(memorizationLogs.id, body.logId),
    });

    if (!log) {
      throw new HTTPException(404, { message: "Memorization log not found" });
    }

    const totalScore =
      (body.tajwidScore + body.fashohahScore + body.fluencyScore) / 3;

    const [assessment] = await db
      .insert(assessments)
      .values({
        id: body.id || uuidv4(),
        logId: body.logId,
        tajwidScore: body.tajwidScore,
        fashohahScore: body.fashohahScore,
        fluencyScore: body.fluencyScore,
        totalScore,
        grade: calculateGrade(totalScore),
        notes: body.notes || null,
        assessedBy: body.assessedBy || user.id,
      })
      .returning();

    await syncService.queueSync(
      "assessments",
      assessment.id,
      "create",
      assessment,
    );

    return c.json(
      {
        success: true,
        message: "Assessment created",
        data: assessment,
      },
      201,
    );
  },
);

// PUT /sync/tahfidz/assessments/:id
tahfidz.put(
  "/assessments/:id",
  teacherOrAdmin,
  zValidator("json", assessmentItemSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const existing = await db.query.assessments.findFirst({
      where: eq(assessments.id, id),
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Assessment not found" });
    }

    const totalScore =
      (body.tajwidScore + body.fashohahScore + body.fluencyScore) / 3;

    const [updated] = await db
      .update(assessments)
      .set({
        tajwidScore: body.tajwidScore,
        fashohahScore: body.fashohahScore,
        fluencyScore: body.fluencyScore,
        totalScore,
        grade: calculateGrade(totalScore),
        notes: body.notes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(assessments.id, id))
      .returning();

    await syncService.queueSync("assessments", id, "update", body);

    return c.json({
      success: true,
      message: "Assessment updated",
      data: updated,
    });
  },
);

// PATCH /sync/tahfidz/assessments/:id
tahfidz.patch(
  "/assessments/:id",
  teacherOrAdmin,
  zValidator("json", updateAssessmentSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const existing = await db.query.assessments.findFirst({
      where: eq(assessments.id, id),
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Assessment not found" });
    }

    // Recalculate total if any score changed
    const tajwid = body.tajwidScore ?? existing.tajwidScore;
    const fashohah = body.fashohahScore ?? existing.fashohahScore;
    const fluency = body.fluencyScore ?? existing.fluencyScore;
    const totalScore = (tajwid + fashohah + fluency) / 3;

    const [updated] = await db
      .update(assessments)
      .set({
        ...body,
        totalScore,
        grade: calculateGrade(totalScore),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(assessments.id, id))
      .returning();

    await syncService.queueSync("assessments", id, "update", body);

    return c.json({
      success: true,
      message: "Assessment updated",
      data: updated,
    });
  },
);

// DELETE /sync/tahfidz/assessments/:id
tahfidz.delete("/assessments/:id", teacherOrAdmin, async (c) => {
  const { id } = c.req.param();

  const existing = await db.query.assessments.findFirst({
    where: eq(assessments.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Assessment not found" });
  }

  await db.delete(assessments).where(eq(assessments.id, id));
  await syncService.queueSync("assessments", id, "delete", { id });

  return c.json({
    success: true,
    message: "Assessment deleted",
  });
});

// ============================================
// GET /sync/tahfidz/surahs - Get all surahs (reference data)
// ============================================
tahfidz.get("/surahs", async (c) => {
  const allSurahs = await db.query.surahs.findMany({
    orderBy: (surahs, { asc }) => [asc(surahs.id)],
  });

  return c.json({
    success: true,
    data: allSurahs,
  });
});

export default tahfidz;
