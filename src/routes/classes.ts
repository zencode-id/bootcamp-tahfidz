import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db, classes, classMembers, users } from "../db/index.js";
import {
  createClassSchema,
  updateClassSchema,
  addClassMemberSchema,
} from "../validators/index.js";
import {
  authMiddleware,
  adminOnly,
  teacherOrAdmin,
} from "../middleware/auth.js";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";

const classRoutes = new Hono();

// Apply auth middleware
classRoutes.use("*", authMiddleware);

// ============================================
// GET /classes - List all classes
// ============================================
classRoutes.get("/", async (c) => {
  const { user } = c.get("auth");

  let allClasses;

  if (user.role === "admin") {
    // Admin can see all classes
    allClasses = await db.query.classes.findMany({
      orderBy: (classes, { desc }) => [desc(classes.createdAt)],
    });
  } else if (user.role === "teacher") {
    // Teachers see classes they teach
    allClasses = await db.query.classes.findMany({
      where: eq(classes.teacherId, user.id),
      orderBy: (classes, { desc }) => [desc(classes.createdAt)],
    });
  } else {
    // Students and parents see classes they're enrolled in
    const enrollments = await db.query.classMembers.findMany({
      where: eq(classMembers.studentId, user.id),
    });

    const classIds = enrollments.map((e) => e.classId);

    if (classIds.length === 0) {
      return c.json({ success: true, data: [], total: 0 });
    }

    allClasses = await db.query.classes.findMany({
      where: sql`${classes.id} IN (${classIds.map((id) => `'${id}'`).join(",")})`,
    });
  }

  // Get teacher names and member counts
  const classesWithDetails = await Promise.all(
    allClasses.map(async (cls) => {
      const teacher = cls.teacherId
        ? await db.query.users.findFirst({
            where: eq(users.id, cls.teacherId),
            columns: { id: true, name: true, email: true },
          })
        : null;

      const memberCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(classMembers)
        .where(eq(classMembers.classId, cls.id));

      return {
        ...cls,
        teacher,
        memberCount: memberCount[0]?.count || 0,
      };
    }),
  );

  return c.json({
    success: true,
    data: classesWithDetails,
    total: classesWithDetails.length,
  });
});

// ============================================
// POST /classes - Create class (admin only)
// ============================================
classRoutes.post(
  "/",
  adminOnly,
  zValidator("json", createClassSchema),
  async (c) => {
    const body = c.req.valid("json");

    // Verify teacher exists if provided
    if (body.teacherId) {
      const teacher = await db.query.users.findFirst({
        where: and(eq(users.id, body.teacherId), eq(users.role, "teacher")),
      });

      if (!teacher) {
        throw new HTTPException(400, { message: "Invalid teacher ID" });
      }
    }

    const [newClass] = await db.insert(classes).values(body).returning();

    return c.json(
      {
        success: true,
        message: "Class created successfully",
        data: newClass,
      },
      201,
    );
  },
);

// ============================================
// GET /classes/:id - Get class details
// ============================================
classRoutes.get("/:id", async (c) => {
  const { id } = c.req.param();

  const cls = await db.query.classes.findFirst({
    where: eq(classes.id, id),
  });

  if (!cls) {
    throw new HTTPException(404, { message: "Class not found" });
  }

  // Get teacher
  const teacher = cls.teacherId
    ? await db.query.users.findFirst({
        where: eq(users.id, cls.teacherId),
        columns: { id: true, name: true, email: true },
      })
    : null;

  // Get members
  const members = await db.query.classMembers.findMany({
    where: eq(classMembers.classId, id),
  });

  const studentsWithDetails = await Promise.all(
    members.map(async (member) => {
      const student = await db.query.users.findFirst({
        where: eq(users.id, member.studentId),
        columns: { id: true, name: true, email: true },
      });
      return {
        ...member,
        student,
      };
    }),
  );

  return c.json({
    success: true,
    data: {
      ...cls,
      teacher,
      members: studentsWithDetails,
      memberCount: members.length,
    },
  });
});

// ============================================
// PUT /classes/:id - Full update class (admin only)
// ============================================
classRoutes.put(
  "/:id",
  adminOnly,
  zValidator("json", updateClassSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const existing = await db.query.classes.findFirst({
      where: eq(classes.id, id),
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Class not found" });
    }

    // Verify teacher if provided
    if (body.teacherId) {
      const teacher = await db.query.users.findFirst({
        where: and(eq(users.id, body.teacherId), eq(users.role, "teacher")),
      });

      if (!teacher) {
        throw new HTTPException(400, { message: "Invalid teacher ID" });
      }
    }

    const [updated] = await db
      .update(classes)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(classes.id, id))
      .returning();

    return c.json({
      success: true,
      message: "Class updated successfully",
      data: updated,
    });
  },
);

// ============================================
// PATCH /classes/:id - Partial update
// ============================================
classRoutes.patch(
  "/:id",
  adminOnly,
  zValidator("json", updateClassSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const existing = await db.query.classes.findFirst({
      where: eq(classes.id, id),
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Class not found" });
    }

    const [updated] = await db
      .update(classes)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(classes.id, id))
      .returning();

    return c.json({
      success: true,
      message: "Class updated successfully",
      data: updated,
    });
  },
);

// ============================================
// DELETE /classes/:id
// ============================================
classRoutes.delete("/:id", adminOnly, async (c) => {
  const { id } = c.req.param();

  const existing = await db.query.classes.findFirst({
    where: eq(classes.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Class not found" });
  }

  // Delete class members first
  await db.delete(classMembers).where(eq(classMembers.classId, id));
  await db.delete(classes).where(eq(classes.id, id));

  return c.json({
    success: true,
    message: "Class deleted successfully",
  });
});

// ============================================
// POST /classes/:id/members - Add student to class
// ============================================
classRoutes.post(
  "/:id/members",
  teacherOrAdmin,
  zValidator("json", addClassMemberSchema.pick({ studentId: true })),
  async (c) => {
    const classId = c.req.param("id");
    const { studentId } = c.req.valid("json");

    // Verify class exists
    const cls = await db.query.classes.findFirst({
      where: eq(classes.id, classId),
    });

    if (!cls) {
      throw new HTTPException(404, { message: "Class not found" });
    }

    // Verify student exists
    const student = await db.query.users.findFirst({
      where: and(eq(users.id, studentId), eq(users.role, "student")),
    });

    if (!student) {
      throw new HTTPException(400, {
        message: "Invalid student ID or user is not a student",
      });
    }

    // Check if already enrolled
    const existing = await db.query.classMembers.findFirst({
      where: and(
        eq(classMembers.classId, classId),
        eq(classMembers.studentId, studentId),
      ),
    });

    if (existing) {
      throw new HTTPException(400, {
        message: "Student is already enrolled in this class",
      });
    }

    const [member] = await db
      .insert(classMembers)
      .values({
        classId,
        studentId,
      })
      .returning();

    return c.json(
      {
        success: true,
        message: "Student added to class",
        data: member,
      },
      201,
    );
  },
);

// ============================================
// DELETE /classes/:id/members/:studentId - Remove student from class
// ============================================
classRoutes.delete("/:id/members/:studentId", teacherOrAdmin, async (c) => {
  const { id: classId, studentId } = c.req.param();

  const existing = await db.query.classMembers.findFirst({
    where: and(
      eq(classMembers.classId, classId),
      eq(classMembers.studentId, studentId),
    ),
  });

  if (!existing) {
    throw new HTTPException(404, {
      message: "Student not found in this class",
    });
  }

  await db
    .delete(classMembers)
    .where(
      and(
        eq(classMembers.classId, classId),
        eq(classMembers.studentId, studentId),
      ),
    );

  return c.json({
    success: true,
    message: "Student removed from class",
  });
});

export default classRoutes;
