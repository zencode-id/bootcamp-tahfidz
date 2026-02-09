import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { db } from "../lib/gasClient.js";
import { bulkAttendanceSchema, attendanceItemSchema, updateAttendanceSchema, attendanceQuerySchema, } from "../validators/index.js";
import { authMiddleware, teacherOrAdmin, canAccessStudent, getAccessibleStudentIds, } from "../middleware/auth.js";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
const sync = new Hono();
// Apply auth middleware to all routes
sync.use("*", authMiddleware);
// ============================================
// POST /sync/attendance - Bulk sync attendance
// ============================================
sync.post("/attendance", teacherOrAdmin, zValidator("json", bulkAttendanceSchema), async (c) => {
    const { items } = c.req.valid("json");
    const { user } = c.get("auth");
    const results = {
        created: 0,
        updated: 0,
        errors: [],
    };
    for (const item of items) {
        try {
            const recordId = item.id || uuidv4();
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
            const existing = await db.attendance.findFirst({ id: item.id });
            if (existing) {
                await db.attendance.update(item.id, attendanceData);
                results.updated++;
            }
            else {
                await db.attendance.create(attendanceData);
                results.created++;
            }
        }
        catch (error) {
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
});
// ============================================
// GET /sync/attendance - Get attendance with filters
// ============================================
sync.get("/attendance", zValidator("query", attendanceQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const auth = c.get("auth");
    // Get accessible student IDs based on user role
    const accessibleIds = await getAccessibleStudentIds(auth);
    // Fetch all attendance
    let data = await db.attendance.findMany({});
    // Filter by accessibility
    if (accessibleIds !== "all") {
        if (accessibleIds.length === 0) {
            return c.json({ success: true, data: [], pagination: { page: query.page, limit: query.limit, total: 0 } });
        }
        data = data.filter((a) => accessibleIds.includes(a.studentId));
    }
    // Apply filters matching query params
    if (query.studentId) {
        if (accessibleIds !== "all" && !accessibleIds.includes(query.studentId)) {
            throw new HTTPException(403, { message: "Access denied" });
        }
        data = data.filter((a) => a.studentId === query.studentId);
    }
    if (query.classId)
        data = data.filter((a) => a.classId === query.classId);
    if (query.sessionType)
        data = data.filter((a) => a.sessionType === query.sessionType);
    if (query.status)
        data = data.filter((a) => a.status === query.status);
    if (query.startDate)
        data = data.filter((a) => a.date >= query.startDate);
    if (query.endDate)
        data = data.filter((a) => a.date <= query.endDate);
    const total = data.length;
    const offset = (query.page - 1) * query.limit;
    // Sort
    data.sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0)
            return dateDiff;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
    const paginatedData = data.slice(offset, offset + query.limit);
    return c.json({
        success: true,
        data: paginatedData,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    });
});
// ============================================
// GET /sync/attendance/:id - Get single attendance
// ============================================
sync.get("/attendance/:id", async (c) => {
    const { id } = c.req.param();
    const auth = c.get("auth");
    const record = await db.attendance.findFirst({ id: id });
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
sync.put("/attendance/:id", teacherOrAdmin, zValidator("json", attendanceItemSchema), async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");
    const { user } = c.get("auth");
    const existing = await db.attendance.findFirst({ id: id });
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
    const updated = await db.attendance.update(id, updatedData);
    return c.json({
        success: true,
        message: "Attendance updated successfully",
        data: updated,
    });
});
// ============================================
// PATCH /sync/attendance/:id - Partial update
// ============================================
sync.patch("/attendance/:id", teacherOrAdmin, zValidator("json", updateAttendanceSchema), async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");
    const existing = await db.attendance.findFirst({ id: id });
    if (!existing) {
        throw new HTTPException(404, { message: "Attendance record not found" });
    }
    const updated = await db.attendance.update(id, body);
    return c.json({
        success: true,
        message: "Attendance updated successfully",
        data: updated,
    });
});
// ============================================
// DELETE /sync/attendance/:id
// ============================================
sync.delete("/attendance/:id", teacherOrAdmin, async (c) => {
    const { id } = c.req.param();
    const existing = await db.attendance.findFirst({ id: id });
    if (!existing) {
        throw new HTTPException(404, { message: "Attendance record not found" });
    }
    await db.attendance.delete(id);
    return c.json({
        success: true,
        message: "Attendance deleted successfully",
    });
});
export default sync;
