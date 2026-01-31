import { Hono } from "hono";
import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, attendance } from "../db/index.js";
import {
  bulkAttendanceSchema,
  attendanceItemSchema,
  updateAttendanceSchema,
  attendanceQuerySchema,
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

const sync = new Hono();

// Apply auth middleware to all routes
sync.use("*", authMiddleware);

// ============================================
// POST /sync/attendance - Bulk sync attendance (offline sync)
// ============================================
sync.post(
  "/attendance",
  teacherOrAdmin,
  zValidator("json", bulkAttendanceSchema),
  async (c) => {
    const { items } = c.req.valid("json");
    const { user } = c.get("auth");

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { id?: string; error: string }[],
    };

    for (const item of items) {
      try {
        // Generate UUID if not provided (for new records)
        const recordId = item.id || uuidv4();

        // Check if record exists
        const existing = item.id
          ? await db.query.attendance.findFirst({
              where: eq(attendance.id, item.id),
            })
          : null;

        const attendanceData = {
          id: recordId,
          studentId: item.studentId,
          classId: item.classId || null,
          sessionType: item.sessionType,
          status: item.status,
          proofUrl: item.proofUrl || null,
          notes: item.notes || null,
          date: item.date,
          recordedBy: user.id,
          syncedAt: new Date().toISOString(),
          syncSource: item.syncSource || "app",
        };

        if (existing) {
          // Update existing record
          await db
            .update(attendance)
            .set({
              ...attendanceData,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(attendance.id, item.id!));

          results.updated++;

          // Queue for GSheet sync
          await syncService.queueSync(
            "attendance",
            item.id!,
            "update",
            attendanceData,
          );
        } else {
          // Insert new record
          await db.insert(attendance).values(attendanceData);
          results.created++;

          // Queue for GSheet sync
          await syncService.queueSync(
            "attendance",
            recordId,
            "create",
            attendanceData,
          );
        }
      } catch (error) {
        results.errors.push({
          id: item.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return c.json({
      success: true,
      message: `Synced ${results.created + results.updated} attendance records`,
      data: results,
    });
  },
);

// ============================================
// GET /sync/attendance - Get attendance with filters
// ============================================
sync.get(
  "/attendance",
  zValidator("query", attendanceQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const auth = c.get("auth");

    // Get accessible student IDs based on user role
    const accessibleIds = await getAccessibleStudentIds(auth);

    // Build where conditions
    const conditions = [];

    // Filter by accessible students
    if (accessibleIds !== "all") {
      if (accessibleIds.length === 0) {
        return c.json({
          success: true,
          data: [],
          pagination: { page: query.page, limit: query.limit, total: 0 },
        });
      }
      conditions.push(inArray(attendance.studentId, accessibleIds));
    }

    // Apply filters
    if (query.studentId) {
      // Verify access to this student
      if (accessibleIds !== "all" && !accessibleIds.includes(query.studentId)) {
        throw new HTTPException(403, {
          message: "Access denied to this student's data",
        });
      }
      conditions.push(eq(attendance.studentId, query.studentId));
    }

    if (query.classId) {
      conditions.push(eq(attendance.classId, query.classId));
    }

    if (query.sessionType) {
      conditions.push(eq(attendance.sessionType, query.sessionType));
    }

    if (query.status) {
      conditions.push(eq(attendance.status, query.status));
    }

    if (query.startDate) {
      conditions.push(gte(attendance.date, query.startDate));
    }

    if (query.endDate) {
      conditions.push(lte(attendance.date, query.endDate));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(attendance)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult[0]?.count || 0;

    // Get paginated data
    const offset = (query.page - 1) * query.limit;

    const data = await db.query.attendance.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      limit: query.limit,
      offset,
      orderBy: (attendance, { desc }) => [
        desc(attendance.date),
        desc(attendance.createdAt),
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
// GET /sync/attendance/:id - Get single attendance
// ============================================
sync.get("/attendance/:id", async (c) => {
  const { id } = c.req.param();
  const auth = c.get("auth");

  const record = await db.query.attendance.findFirst({
    where: eq(attendance.id, id),
  });

  if (!record) {
    throw new HTTPException(404, { message: "Attendance record not found" });
  }

  // Check access
  const hasAccess = await canAccessStudent(auth, record.studentId);
  if (!hasAccess) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  return c.json({
    success: true,
    data: record,
  });
});

// ============================================
// PUT /sync/attendance/:id - Full update
// ============================================
sync.put(
  "/attendance/:id",
  teacherOrAdmin,
  zValidator("json", attendanceItemSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");
    const { user } = c.get("auth");

    const existing = await db.query.attendance.findFirst({
      where: eq(attendance.id, id),
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Attendance record not found" });
    }

    const updatedData = {
      studentId: body.studentId,
      classId: body.classId || null,
      sessionType: body.sessionType,
      status: body.status,
      proofUrl: body.proofUrl || null,
      notes: body.notes || null,
      date: body.date,
      recordedBy: user.id,
      updatedAt: new Date().toISOString(),
    };

    const [updated] = await db
      .update(attendance)
      .set(updatedData)
      .where(eq(attendance.id, id))
      .returning();

    // Queue for GSheet sync
    await syncService.queueSync("attendance", id, "update", updatedData);

    return c.json({
      success: true,
      message: "Attendance updated successfully",
      data: updated,
    });
  },
);

// ============================================
// PATCH /sync/attendance/:id - Partial update
// ============================================
sync.patch(
  "/attendance/:id",
  teacherOrAdmin,
  zValidator("json", updateAttendanceSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const existing = await db.query.attendance.findFirst({
      where: eq(attendance.id, id),
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Attendance record not found" });
    }

    const [updated] = await db
      .update(attendance)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(attendance.id, id))
      .returning();

    // Queue for GSheet sync
    await syncService.queueSync("attendance", id, "update", body);

    return c.json({
      success: true,
      message: "Attendance updated successfully",
      data: updated,
    });
  },
);

// ============================================
// DELETE /sync/attendance/:id
// ============================================
sync.delete("/attendance/:id", teacherOrAdmin, async (c) => {
  const { id } = c.req.param();

  const existing = await db.query.attendance.findFirst({
    where: eq(attendance.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Attendance record not found" });
  }

  await db.delete(attendance).where(eq(attendance.id, id));

  // Queue for GSheet sync
  await syncService.queueSync("attendance", id, "delete", { id });

  return c.json({
    success: true,
    message: "Attendance deleted successfully",
  });
});

export default sync;
