import { Hono } from "hono";
import { db } from "../lib/gasClient.js";
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
import { Class, User, ClassMember } from "../types/index.js";

const classRoutes = new Hono();

// Apply auth middleware
classRoutes.use("*", authMiddleware);

// ============================================
// GET /classes - List all classes
// ============================================
classRoutes.get("/", async (c) => {
  const { user } = c.get("auth");

  let allClasses: any[] = [];

  if (user.role === "admin") {
    // Admin can see all classes
    allClasses = await db.classes.findMany({});
  } else if (user.role === "teacher") {
    // Teachers see classes they teach
    allClasses = await db.classes.findMany({
      teacherId: user.id
    });
  } else {
    // Students and parents see classes they're enrolled in
    // 1. Get enrollments
    const enrollments = await db.classMembers.findMany({
      studentId: user.id
    });

    const classIds = enrollments.map((e: any) => e.classId);

    if (classIds.length === 0) {
      return c.json({ success: true, data: [], total: 0 });
    }

    // 2. Fetch all classes and filter (GAS limit)
    const rawClasses = await db.classes.findMany({});
    allClasses = rawClasses.filter((cls: any) => classIds.includes(cls.id));
  }

  // Get teacher names and member counts
  const classesWithDetails = await Promise.all(
    allClasses.map(async (cls) => {
      let teacher = null;
      if (cls.teacherId) {
          teacher = await db.users.findFirst({ id: cls.teacherId });
          if (teacher) {
              teacher = { id: teacher.id, name: teacher.name, email: teacher.email };
          }
      }

      // Member count - inefficient but functional for MVP serverless
      const members = await db.classMembers.findMany({ classId: cls.id });
      const memberCount = members.length;

      return {
        ...cls,
        teacher,
        memberCount: memberCount,
      };
    }),
  );

  // Sort desc by createdAt
  classesWithDetails.sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

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
      const teacher = await db.users.findFirst({
         id: body.teacherId
      });

      if (!teacher || teacher.role !== 'teacher') {
        throw new HTTPException(400, { message: "Invalid teacher ID" });
      }
    }

    const newClass = await db.classes.create({
        ...body,
        isActive: true
    });

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

  const cls = await db.classes.findFirst({
    id: id,
  });

  if (!cls) {
    throw new HTTPException(404, { message: "Class not found" });
  }

  // Get teacher
  let teacher = null;
  if (cls.teacherId) {
    const teacherUser = await db.users.findFirst({ id: cls.teacherId });
    if(teacherUser) {
        teacher = { id: teacherUser.id, name: teacherUser.name, email: teacherUser.email };
    }
  }

  // Get members
  const members = await db.classMembers.findMany({
    classId: id
  });

  const studentsWithDetails = await Promise.all(
    members.map(async (member: any) => {
      const student = await db.users.findFirst({
        id: member.studentId
      });

      const safeStudent = student ? { id: student.id, name: student.name, email: student.email } : null;

      return {
        ...member,
        student: safeStudent,
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

    const existing = await db.classes.findFirst({
      id: id,
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Class not found" });
    }

    // Verify teacher if provided
    if (body.teacherId) {
      const teacher = await db.users.findFirst({
         id: body.teacherId
      });

      if (!teacher || teacher.role !== 'teacher') {
        throw new HTTPException(400, { message: "Invalid teacher ID" });
      }
    }

    const updated = await db.classes.update(id, body);

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

    const existing = await db.classes.findFirst({
      id: id,
    });

    if (!existing) {
      throw new HTTPException(404, { message: "Class not found" });
    }

    const updated = await db.classes.update(id, body);

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

  const existing = await db.classes.findFirst({
    id: id,
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Class not found" });
  }

  // Delete class members first
  const members = await db.classMembers.findMany({ classId: id });
  for (const member of members) {
      await db.classMembers.delete(member.id);
  }

  await db.classes.delete(id);

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
    const cls = await db.classes.findFirst({
      id: classId,
    });

    if (!cls) {
      throw new HTTPException(404, { message: "Class not found" });
    }

    // Verify student exists
    const student = await db.users.findFirst({
      id: studentId
    });

    if (!student || student.role !== 'student') {
      throw new HTTPException(400, {
        message: "Invalid student ID or user is not a student",
      });
    }

    // Check if already enrolled (Fetch all members of this class and check)
    // GASClient findMany with multiple conditions support check:
    // If our GAS script only supports simple AND, we can try { classId, studentId }
    // My previous GAS script update handles this if key-values match row.
    const existingMembers = await db.classMembers.findMany({
        classId: classId,
        studentId: studentId
    });

    if (existingMembers.length > 0) {
      throw new HTTPException(400, {
        message: "Student is already enrolled in this class",
      });
    }

    const member = await db.classMembers.create({
        classId,
        studentId,
        joinedAt: new Date().toISOString()
    });

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

  const existingMembers = await db.classMembers.findMany({
      classId: classId,
      studentId: studentId
  });

  if (existingMembers.length === 0) {
    throw new HTTPException(404, {
      message: "Student not found in this class",
    });
  }

  const memberToDelete = existingMembers[0]; // Should be unique

  await db.classMembers.delete(memberToDelete.id);

  return c.json({
    success: true,
    message: "Student removed from class",
  });
});

// ============================================
// POST /classes/:id/transfer - Transfer student to another class
// ============================================
classRoutes.post("/:id/transfer", teacherOrAdmin, async (c) => {
  const { id: fromClassId } = c.req.param();
  const { studentId, toClassId } = await c.req.json();

  if (!studentId || !toClassId) {
    throw new HTTPException(400, { message: "studentId and toClassId are required" });
  }

  // Verify source class exists
  const fromClass = await db.classes.findFirst({ id: fromClassId });
  if (!fromClass) {
    throw new HTTPException(404, { message: "Source class not found" });
  }

  // Verify destination class exists
  const toClass = await db.classes.findFirst({ id: toClassId });
  if (!toClass) {
    throw new HTTPException(404, { message: "Destination class not found" });
  }

  // Check if student is in source class
  const existingMembership = await db.classMembers.findMany({
    classId: fromClassId,
    studentId: studentId
  });

  if (existingMembership.length === 0) {
    throw new HTTPException(400, { message: "Student is not in source class" });
  }

  // Check if already in destination class
  const destMembership = await db.classMembers.findMany({
    classId: toClassId,
    studentId: studentId
  });

  // Remove from source class
  await db.classMembers.delete(existingMembership[0].id);

  // Add to destination class (if not already there)
  if (destMembership.length === 0) {
    await db.classMembers.create({
      classId: toClassId,
      studentId: studentId,
      joinedAt: new Date().toISOString()
    });
  }

  return c.json({
    success: true,
    message: `Student transferred from ${fromClass.name} to ${toClass.name}`,
  });
});

// ============================================
// POST /classes/cleanup-inactive - Remove inactive students from all classes
// ============================================
classRoutes.post("/cleanup-inactive", adminOnly, async (c) => {
  const allUsers = await db.users.findMany({}, 1000);
  const allMembers = await db.classMembers.findMany({}, 1000);

  // Find inactive user IDs
  const inactiveUserIds = allUsers
    .filter((u: any) => {
      const isActive = u.isActive === true || u.isActive === "true" || u.isActive === "TRUE";
      return !isActive;
    })
    .map((u: any) => u.id);

  // Find memberships where studentId is inactive
  const membershipsToRemove = allMembers.filter((m: any) =>
    inactiveUserIds.includes(m.studentId)
  );

  let removedCount = 0;
  for (const membership of membershipsToRemove) {
    await db.classMembers.delete(membership.id);
    removedCount++;
  }

  return c.json({
    success: true,
    message: `Removed ${removedCount} inactive students from classes`,
    removedCount,
  });
});

export default classRoutes;
