import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "../db/index.js";
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

  // Generate token
  const token = generateToken(user);

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
auth.get("/users", authMiddleware, adminOnly, async (c) => {
  const allUsers = await db.query.users.findMany({
    columns: {
      password: false, // Exclude password
    },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  return c.json({
    success: true,
    data: allUsers,
    total: allUsers.length,
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
