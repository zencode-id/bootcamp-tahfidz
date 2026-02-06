import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { db } from "../lib/sheetsClient.js";
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
import { User } from "../types/index.js";

const auth = new Hono();

// ============================================
// POST /auth/register
// ============================================
auth.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");

  // Check if email already exists
  const existingUser = await db.users.findFirst({
    email: body.email,
  });

  if (existingUser) {
    throw new HTTPException(400, { message: "Email already registered" });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(body.password, 12);

  // Create user
  const newUser = await db.users.create({
      ...body,
      password: hashedPassword,
      isActive: true, // Default to true
      role: body.role || "student"
  });

  // Generate token
  const token = generateToken(newUser as User);

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

  console.log(`[LOGIN] Start login for ${email}`);
  const startTotal = Date.now();

  // Find user
  console.time("db_find_user");
  const user = await db.users.findFirst({
    email: email,
  });
  console.timeEnd("db_find_user");
  console.log(`[LOGIN] User found: ${!!user}, Time: ${Date.now() - startTotal}ms`);

  if (!user) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  // Check if user is active
  // Handle string/boolean mismatch from GAS - be very permissive
  const isActiveValue = user.isActive;
  const isActive =
    isActiveValue === true ||
    isActiveValue === "true" ||
    isActiveValue === "TRUE" ||
    isActiveValue === "True" ||
    isActiveValue === "ON" ||
    isActiveValue === "on" ||
    isActiveValue === "Active" ||
    isActiveValue === "active" ||
    isActiveValue === 1 ||
    isActiveValue === "1" ||
    isActiveValue === "yes" ||
    isActiveValue === "YES" ||
    // Also check for checkbox that returns boolean
    (typeof isActiveValue === 'boolean' && isActiveValue);

  if (!isActive) {
    throw new HTTPException(403, { message: `Account is deactivated` });
  }

  console.time("bcrypt_compare");
  const startBcrypt = Date.now();
  const isValidPassword = await bcrypt.compare(password, user.password);
  console.timeEnd("bcrypt_compare");
  console.log(`[LOGIN] Password valid: ${isValidPassword}, Bcrypt time: ${Date.now() - startBcrypt}ms`);

  if (!isValidPassword) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  // Generate Token directly (No OTP)
  const token = generateToken(user as User);

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
// POST /auth/verify-otp (Step 2: Validate OTP & Issue Token)
// ============================================
auth.post("/verify-otp", async (c) => {
  const { email, code } = await c.req.json();

  if (!email || !code) {
    throw new HTTPException(400, { message: "Email and code are required" });
  }

  // Find user
  const user = await db.users.findFirst({
    email: email,
  });

  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  // Verify OTP
  // Get latest active OTP for user
  const otps = await db.otpCodes.findMany({
    userId: user.id,
    code: code,
  });

  // Sort in memory (descending by createdAt/numeric ID usually correlates)
  // Warning: creation order might not be guaranteed if id is uuid unless we parse dates
  const existingOtp = otps.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];

  if (!existingOtp) {
    throw new HTTPException(400, { message: "Invalid OTP" });
  }

  // Check expiry
  if (existingOtp.expiresAt < Date.now()) {
    throw new HTTPException(400, { message: "OTP expired" });
  }

  // Generate Request Token (JWT)
  const token = generateToken(user as User);

  // Cleanup used OTP (optional, or mark as used)
  await db.otpCodes.delete(existingOtp.id);

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
// ============================================
// PUT /auth/me - Update current user profile
// ============================================
auth.put(
  "/me",
  authMiddleware,
  zValidator("json", updateUserSchema),
  async (c) => {
    const { user } = c.get("auth");
    const body: any = c.req.valid("json");

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
      const existingUser = await db.users.findFirst({
        email: body.email,
      });

      if (existingUser) {
        throw new HTTPException(400, { message: "Email already in use" });
      }
    }

    const updatedUser = await db.users.update(user.id, {
        ...body,
        updatedAt: new Date().toISOString(),
    });

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
// ============================================
// ADMIN ROUTES
// ============================================

// GET /auth/users - Get all users with pagination and filtering (admin only)
auth.get("/users", authMiddleware, adminOnly, async (c) => {
  const query = c.req.query();
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const offset = (page - 1) * limit;

  const role = query.role;
  const isActive = query.is_active;
  const search = query.q;

  // 1. Fetch All (filtered by role if possible to reduce load, but our simple client supports simple object match)
  // For searching and complex filtering, we fetch all first.
  let allUsers: any[] = await db.users.findMany({}, 1000);

  // 2. Filter in Memory
  if (role) {
      allUsers = allUsers.filter(u => u.role === role);
  }

  if (isActive !== undefined) {
    const isTrue = isActive === "true" || isActive === "1" || isActive === "on";
    // Handle potential string boolean from Sheets
    allUsers = allUsers.filter(u => {
        const uActive = u.isActive === true || u.isActive === "true" || u.isActive === "TRUE";
        return uActive === isTrue;
    });
  }

  if (search) {
    const searchLower = search.toLowerCase();
    allUsers = allUsers.filter(u =>
        (u.name && u.name.toLowerCase().includes(searchLower)) ||
        (u.email && u.email.toLowerCase().includes(searchLower))
    );
  }

  const total = allUsers.length;

  // Sort by createdAt desc
  allUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // 3. Paginate
  const slicedUsers = allUsers.slice(offset, offset + limit);

  // Hide passwords
  const safeUsers = slicedUsers.map(u => {
      const { password, ...rest } = u;
      return rest;
  });

  return c.json({
    success: true,
    data: safeUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /auth/users - Create new user (admin only)
auth.post("/users", authMiddleware, adminOnly, async (c) => {
  const body = await c.req.json();

  // Validate required fields
  if (!body.name || !body.email || !body.password) {
    throw new HTTPException(400, {
      message: "Name, email, and password are required",
    });
  }

  // Check if email already exists
  const existingUser = await db.users.findFirst({ email: body.email.toLowerCase() });
  if (existingUser) {
    throw new HTTPException(400, { message: "Email already exists" });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(body.password, 10);

  // Create user
  const newUser = await db.users.create({
    name: body.name,
    email: body.email.toLowerCase(),
    password: hashedPassword,
    role: body.role || "student",
    isActive: body.isActive !== false,
    phone: body.phone || "",
    address: body.address || "",
    parentId: body.parentId || null,
  });

  const { password, ...safeUser } = newUser;

  return c.json(
    {
      success: true,
      message: "User created successfully",
      data: safeUser,
    },
    201
  );
});

// GET /auth/users/:id - Get user by ID (admin only)
auth.get("/users/:id", authMiddleware, adminOnly, async (c) => {
  const { id } = c.req.param();

  const user = await db.users.findFirst({
    id: id
  });

  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  const { password, ...safeUser } = user;

  return c.json({
    success: true,
    data: safeUser,
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
    const body: any = c.req.valid("json");

    // Check if user exists
    const existingUser = await db.users.findFirst({
      id: id
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
      const emailUser = await db.users.findFirst({
        email: body.email
      });

      if (emailUser) {
        throw new HTTPException(400, { message: "Email already in use" });
      }
    }

    const updatedUser = await db.users.update(id, {
        ...body,
        updatedAt: new Date().toISOString(),
    });

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
    const body: any = c.req.valid("json");

    // Check if user exists
    const existingUser = await db.users.findFirst({
      id: id
    });

    if (!existingUser) {
      throw new HTTPException(404, { message: "User not found" });
    }

    // Hash password if provided
    if (body.password) {
      body.password = await bcrypt.hash(body.password, 12);
    }

    const updatedUser = await db.users.update(id, {
        ...body,
        updatedAt: new Date().toISOString(),
    });

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
  const existingUser = await db.users.findFirst({
    id: id
  });

  if (!existingUser) {
    throw new HTTPException(404, { message: "User not found" });
  }

  await db.users.delete(id);

  return c.json({
    success: true,
    message: "User deleted successfully",
  });
});

export default auth;
