import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";

// Types need to be defined or imported
interface Env {
  DB: D1Database;
  STORAGE?: R2Bucket;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BREVO_API_KEY: string;
  SENDER_EMAIL: string;
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// HELPER FUNCTIONS

export function getSecretKey(env: Env): Uint8Array {
  const secret = env.JWT_SECRET || "your-super-secret-jwt-key";
  return new TextEncoder().encode(secret);
}

export async function generateToken(user: typeof schema.users.$inferSelect, env: Env): Promise<string> {
  const secret = getSecretKey(env);
  const expiresIn = env.JWT_EXPIRES_IN || "7d";

  // Parse expiresIn to seconds
  let expirationTime = "7d";
  if (expiresIn.endsWith("d")) {
    expirationTime = expiresIn;
  } else if (expiresIn.endsWith("h")) {
    expirationTime = expiresIn;
  } else {
    expirationTime = "7d";
  }

  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secret);

  return token;
}

export async function verifyToken(token: string, env: Env): Promise<JWTPayload> {
  try {
    const secret = getSecretKey(env);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch (error) {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
}

// Simple password hashing using Web Crypto API (Workers compatible)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  // Use multiple rounds of SHA-256 with salt for better security
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltedData = new Uint8Array([...salt, ...data]);

  let hash = await crypto.subtle.digest("SHA-256", saltedData);

  // Apply 10000 rounds
  for (let i = 0; i < 10000; i++) {
    hash = await crypto.subtle.digest("SHA-256", hash);
  }

  const hashArray = new Uint8Array(hash);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

  return `$sha256$${saltHex}$${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Handle bcrypt hashes (for backward compatibility)
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$")) {
    // For bcrypt, we need a different approach - compare using timing-safe method
    // Since we can't use bcrypt in Workers, we'll need to use a workaround
    // For now, let's use a simple comparison for migration purposes
    // In production, you'd want to migrate passwords
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    let hash = await crypto.subtle.digest("SHA-256", data);
    for (let i = 0; i < 10000; i++) {
      hash = await crypto.subtle.digest("SHA-256", hash);
    }
    // This is a simplified check - in real migration, passwords should be re-hashed on first login
    return false; // Force re-login with new password for bcrypt users
  }

  // Handle our SHA-256 hashes
  if (storedHash.startsWith("$sha256$")) {
    const parts = storedHash.split("$");
    const saltHex = parts[2];
    const originalHashHex = parts[3];

    // Reconstruct salt from hex
    const salt = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      salt[i] = parseInt(saltHex.substr(i * 2, 2), 16);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const saltedData = new Uint8Array([...salt, ...data]);

    let hash = await crypto.subtle.digest("SHA-256", saltedData);
    for (let i = 0; i < 10000; i++) {
      hash = await crypto.subtle.digest("SHA-256", hash);
    }

    const hashArray = new Uint8Array(hash);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex === originalHashHex;
  }

  return false;
}

// Auth middleware factory
export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    throw new HTTPException(401, {
      message: "Missing authorization header",
    });
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new HTTPException(401, {
      message: "Invalid authorization header format (Bearer required)",
    });
  }

  const token = authHeader.substring(7);
  // c.env is accessible in Context but needs type assertion or generic
  const env = c.env as unknown as Env;

  const payload = await verifyToken(token, env);
  const db = c.get("db") as any; // Assuming db is set in context

  // Fetch user from database
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, payload.userId),
  });

  if (!user) {
    throw new HTTPException(401, { message: "User not found" });
  }

  if (!user.isActive) {
    throw new HTTPException(403, { message: "User account is deactivated" });
  }

  c.set("auth", { user, payload } as any);
  c.set("jwtPayload", payload as any);

  await next();
};

// Admin only middleware
export const adminOnly = async (c: Context, next: Next) => {
  const auth = c.get("auth") as any;

  if (!auth) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  if (auth.user.role !== "admin") {
    throw new HTTPException(403, {
      message: "Access denied. Admin role required.",
    });
  }

  await next();
};
