import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { db } from "../lib/sheetsClient.js";
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

        // Attempt to find existing (fetch all or findFirst if supported)
        const existing = await db.memorizationLogs.findFirst({ id: log.id });

        if (existing) {
          await db.memorizationLogs.update(log.id!, logData);
          results.logs.updated++;
        } else {
          await db.memorizationLogs.create(logData);
          results.logs.created++;
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

        const existing = await db.assessments.findFirst({ id: assessment.id });

        if (existing) {
          await db.assessments.update(assessment.id!, assessmentData);
          results.assessments.updated++;
        } else {
          await db.assessments.create(assessmentData);
          results.assessments.created++;
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

// Query schema
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

    // Fetch all logs then filter
    // GASClient limitation means we fetch all logs if we can't filter server-side
    // Optimization: If query.studentId is provided, fetch by studentId.
    let logs = [];

    if (query.studentId) {
        if (accessibleIds !== "all" && !accessibleIds.includes(query.studentId)) {
            throw new HTTPException(403, { message: "Access denied" });
        }
        logs = await db.memorizationLogs.findMany({ studentId: query.studentId });
    } else {
        logs = await db.memorizationLogs.findMany({}); // Heavy fetch
    }

    // Filter
    if (accessibleIds !== "all") {
        logs = logs.filter((l: any) => accessibleIds.includes(l.studentId));
    }

    if (query.type) logs = logs.filter((l: any) => l.type === query.type);
    if (query.surahId) logs = logs.filter((l: any) => l.surahId == query.surahId);
    if (query.startDate) logs = logs.filter((l: any) => l.sessionDate >= query.startDate!);
    if (query.endDate) logs = logs.filter((l: any) => l.sessionDate <= query.endDate!);

    const total = logs.length;
    const offset = (query.page - 1) * query.limit;

    // Sort descending by date
    logs.sort((a: any, b: any) => {
        const dateDiff = b.sessionDate.localeCompare(a.sessionDate);
        if (dateDiff !== 0) return dateDiff;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    const paginatedLogs = logs.slice(offset, offset + query.limit);

    return c.json({
      success: true,
      data: paginatedLogs,
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

  const log = await db.memorizationLogs.findFirst({ id: id });

  if (!log) {
    throw new HTTPException(404, { message: "Memorization log not found" });
  }

  const hasAccess = await canAccessStudent(auth, log.studentId);
  if (!hasAccess) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  // Get associated assessment
  // GASClient doesn't support complex joins. We need to check all assessments for this logId.
  // Assuming assessments table can be filtered by logId if we had index support.
  // Without it, fetching all assessments is heavy.
  // Optimization: If assessment ID is stored in log? No.
  // We'll fetch all assessments and find.
  const allAssessments = await db.assessments.findMany({});
  const assessment = allAssessments.find((a: any) => a.logId === id) || null;

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

    const existing = await db.memorizationLogs.findFirst({ id: id });

    if (!existing) {
      throw new HTTPException(404, { message: "Memorization log not found" });
    }

    const updated = await db.memorizationLogs.update(id, body);

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

    const existing = await db.memorizationLogs.findFirst({ id: id });

    if (!existing) {
      throw new HTTPException(404, { message: "Memorization log not found" });
    }

    const updated = await db.memorizationLogs.update(id, body);

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

  const existing = await db.memorizationLogs.findFirst({ id: id });

  if (!existing) {
    throw new HTTPException(404, { message: "Memorization log not found" });
  }

  // Delete associated assessments first
  const allAssessments = await db.assessments.findMany({});
  const assessment = allAssessments.find((a: any) => a.logId === id);
  if (assessment) {
      await db.assessments.delete(assessment.id);
  }

  await db.memorizationLogs.delete(id);

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
    const log = await db.memorizationLogs.findFirst({ id: body.logId });

    if (!log) {
      throw new HTTPException(404, { message: "Memorization log not found" });
    }

    const totalScore =
      (body.tajwidScore + body.fashohahScore + body.fluencyScore) / 3;

    const assessment = await db.assessments.create({
        id: body.id || uuidv4(),
        logId: body.logId,
        tajwidScore: body.tajwidScore,
        fashohahScore: body.fashohahScore,
        fluencyScore: body.fluencyScore,
        totalScore,
        grade: calculateGrade(totalScore),
        notes: body.notes || null,
        assessedBy: body.assessedBy || user.id,
    });

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

    const existing = await db.assessments.findFirst({ id: id });

    if (!existing) {
      throw new HTTPException(404, { message: "Assessment not found" });
    }

    const totalScore =
      (body.tajwidScore + body.fashohahScore + body.fluencyScore) / 3;

    const updated = await db.assessments.update(id, {
        tajwidScore: body.tajwidScore,
        fashohahScore: body.fashohahScore,
        fluencyScore: body.fluencyScore,
        totalScore,
        grade: calculateGrade(totalScore),
        notes: body.notes,
    });

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

    const existing = await db.assessments.findFirst({ id: id });

    if (!existing) {
      throw new HTTPException(404, { message: "Assessment not found" });
    }

    const tajwid = body.tajwidScore ?? existing.tajwidScore;
    const fashohah = body.fashohahScore ?? existing.fashohahScore;
    const fluency = body.fluencyScore ?? existing.fluencyScore;
    const totalScore = (tajwid + fashohah + fluency) / 3;

    const updated = await db.assessments.update(id, {
        ...body,
        totalScore,
        grade: calculateGrade(totalScore),
    });

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

  const existing = await db.assessments.findFirst({ id: id });

  if (!existing) {
    throw new HTTPException(404, { message: "Assessment not found" });
  }

  await db.assessments.delete(id);

  return c.json({
    success: true,
    message: "Assessment deleted",
  });
});

// ============================================
// GET /sync/tahfidz/surahs - Get all surahs (reference data)
// ============================================
tahfidz.get("/surahs", async (c) => {
  const allSurahs = await db.dataQuran.findMany({});

  // Sort by id
  allSurahs.sort((a: any, b: any) => Number(a.id) - Number(b.id));

  return c.json({
    success: true,
    data: allSurahs,
  });
});

export default tahfidz;
