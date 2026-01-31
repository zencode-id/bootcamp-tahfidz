import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import { db, users, otpCodes } from "../db/index.js";
import {
  loginSchema,
  registerSchema,
  updateUserSchema,
} from "../validators/index.js";
import {
  generateToken,
  authMiddleware,
  adminOnly,
} from "../middleware/auth.js";
import { sendOtpEmail } from "../services/brevo.js";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";

const auth = new Hono();

// ============================================
// POST /auth/register
// ============================================
auth.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");

  // Check if email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, body.email),
  });

  if (existingUser) {
    throw new HTTPException(400, { message: "Email already registered" });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(body.password, 12);

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      ...body,
      password: hashedPassword,
    })
    .returning();

  // Generate token
  const token = generateToken(newUser);

  return c.json(
    {
      success: true,
      message: "Registration successful",
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
        token,
      },
    },
    201,
  );
});

// ============================================
// POST /auth/login
// ============================================
// ============================================
// POST /auth/login (Step 1: Validate credentials & Send OTP)
// ============================================
auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");

  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  // Check if user is active
  if (!user.isActive) {
    throw new HTTPException(403, { message: "Account is deactivated" });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  // Generate OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

  // Save OTP to DB
  await db.insert(otpCodes).values({
    userId: user.id,
    code: otp,
    expiresAt: expiresAt.getTime(), // Store as timestamp
  });

  // Send OTP via Brevo
  try {
    await sendOtpEmail(user.email, otp, user.name);
  } catch (error) {
    console.error("Failed to send email", error);
    // For dev, we might still want to proceed or return error?
    // throw new HTTPException(500, { message: "Failed to send OTP email" });
  }

  return c.json({
    success: true,
    message: "OTP sent to email",
    data: {
      email: user.email,
      role: user.role, // Return role so frontend knows where to redirect after verification? Or maybe wait until verify to return sensitive info.
    },
  });
});

// ============================================
// POST /auth/verify-otp (Step 2: Validate OTP & Issue Token)
// ============================================
auth.post("/verify-otp", async (c) => {
  const { email, code } = await c.req.json();

  if (!email || !code) {
    throw new HTTPException(400, { message: "Email and code are required" });
  }

  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  // Verify OTP
  // Get latest active OTP for user
  const existingOtp = await db.query.otpCodes.findFirst({
    where: and(eq(otpCodes.userId, user.id), eq(otpCodes.code, code)),
    orderBy: (otpCodes, { desc }) => [desc(otpCodes.createdAt)],
  });

  if (!existingOtp) {
    throw new HTTPException(400, { message: "Invalid OTP" });
  }

  // Check expiry
  if (existingOtp.expiresAt < Date.now()) {
    throw new HTTPException(400, { message: "OTP expired" });
  }

  // Generate Request Token (JWT)
  const token = generateToken(user);

  // Cleanup used OTP (optional, or mark as used)
  await db.delete(otpCodes).where(eq(otpCodes.id, existingOtp.id));

  return c.json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    },
  });
});

// ============================================
// GET /auth/me - Get current user profile
// ============================================
auth.get("/me", authMiddleware, async (c) => {
  const { user } = c.get("auth");

  return c.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      parentId: user.parentId,
      createdAt: user.createdAt,
    },
  });
});

// ============================================
// PUT /auth/me - Update current user profile
// ============================================
auth.put(
  "/me",
  authMiddleware,
  zValidator("json", updateUserSchema),
  async (c) => {
    const { user } = c.get("auth");
    const body = c.req.valid("json");

    // Don't allow role change through profile update (except for admin)
    if (body.role && user.role !== "admin") {
      delete body.role;
    }

    // Hash new password if provided
    if (body.password) {
      body.password = await bcrypt.hash(body.password, 12);
    }

    // Check email uniqueness if changing
    if (body.email && body.email !== user.email) {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, body.email),
      });

      if (existingUser) {
        throw new HTTPException(400, { message: "Email already in use" });
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id))
      .returning();

    return c.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        address: updatedUser.address,
      },
    });
  },
);

// ============================================
// ADMIN ROUTES
// ============================================

// GET /auth/users - Get all users (admin only)
// GET /auth/users - Get all users with pagination and filtering (admin only)
auth.get("/users", authMiddleware, adminOnly, async (c) => {
  const query = c.req.query();
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const offset = (page - 1) * limit;

  const role = query.role;
  const isActive = query.is_active;
  const search = query.q;

  // Build conditions
  const conditions = [];

  if (role) {
    conditions.push(eq(users.role, role as any));
  }

  if (isActive !== undefined) {
    const isTrue = isActive === "true" || isActive === "1" || isActive === "on";
    conditions.push(eq(users.isActive, isTrue));
  }

  if (search) {
    const searchLower = search.toLowerCase();
    conditions.push(
      sql`(lower(${users.name}) LIKE ${`%${searchLower}%`} OR lower(${users.email}) LIKE ${`%${searchLower}%`})`,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get data
  const allUsers = await db.query.users.findMany({
    where: whereClause,
    columns: {
      password: false, // Exclude password
    },
    limit: limit,
    offset: offset,
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  // Get total count
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(whereClause);

  const total = totalResult[0]?.count || 0;

  return c.json({
    success: true,
    data: allUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /auth/users/:id - Get user by ID (admin only)
auth.get("/users/:id", authMiddleware, adminOnly, async (c) => {
  const { id } = c.req.param();

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      password: false,
    },
  });

  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  return c.json({
    success: true,
    data: user,
  });
});

// PUT /auth/users/:id - Full update user (admin only)
auth.put(
  "/users/:id",
  authMiddleware,
  adminOnly,
  zValidator("json", updateUserSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      throw new HTTPException(404, { message: "User not found" });
    }

    // Hash password if provided
    if (body.password) {
      body.password = await bcrypt.hash(body.password, 12);
    }

    // Check email uniqueness
    if (body.email && body.email !== existingUser.email) {
      const emailUser = await db.query.users.findFirst({
        where: eq(users.email, body.email),
      });

      if (emailUser) {
        throw new HTTPException(400, { message: "Email already in use" });
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning();

    return c.json({
      success: true,
      message: "User updated successfully",
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      },
    });
  },
);

// PATCH /auth/users/:id - Partial update user (admin only)
auth.patch(
  "/users/:id",
  authMiddleware,
  adminOnly,
  zValidator("json", updateUserSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      throw new HTTPException(404, { message: "User not found" });
    }

    // Hash password if provided
    if (body.password) {
      body.password = await bcrypt.hash(body.password, 12);
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning();

    return c.json({
      success: true,
      message: "User updated successfully",
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  },
);

// DELETE /auth/users/:id - Delete user (admin only)
auth.delete("/users/:id", authMiddleware, adminOnly, async (c) => {
  const { id } = c.req.param();
  const { user: currentUser } = c.get("auth");

  // Prevent self-deletion
  if (id === currentUser.id) {
    throw new HTTPException(400, { message: "Cannot delete your own account" });
  }

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (!existingUser) {
    throw new HTTPException(404, { message: "User not found" });
  }

  await db.delete(users).where(eq(users.id, id));

  return c.json({
    success: true,
    message: "User deleted successfully",
  });
});

export default auth;
