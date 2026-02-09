import { HTTPException } from "hono/http-exception";
import jwt from "jsonwebtoken";
import { db } from "../lib/gasClient.js"; // Use GAS Client
// ============================================
// JWT HELPERS
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export function generateToken(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
}
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch (error) {
        throw new HTTPException(401, { message: "Invalid or expired token" });
    }
}
// ============================================
// AUTH MIDDLEWARE
// ============================================
export async function authMiddleware(c, next) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new HTTPException(401, {
            message: "Missing or invalid authorization header",
        });
    }
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    // Fetch user from Google Sheets
    const user = await db.users.findFirst({
        id: payload.userId
    });
    if (!user) {
        throw new HTTPException(401, { message: "User not found" });
    }
    if (typeof user.isActive === 'string') {
        user.isActive = user.isActive === 'TRUE' || user.isActive === 'true';
    }
    if (!user.isActive) {
        throw new HTTPException(403, { message: "User account is deactivated" });
    }
    // Set auth context
    c.set("auth", { user, payload });
    c.set("jwtPayload", payload);
    await next();
}
// ============================================
// RBAC MIDDLEWARE
// ============================================
export function requireRoles(...allowedRoles) {
    return async (c, next) => {
        const auth = c.get("auth");
        if (!auth) {
            throw new HTTPException(401, { message: "Authentication required" });
        }
        if (!allowedRoles.includes(auth.user.role)) {
            throw new HTTPException(403, {
                message: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
            });
        }
        await next();
    };
}
// Convenience middleware for common role combinations
export const adminOnly = requireRoles("admin");
export const teacherOrAdmin = requireRoles("admin", "teacher");
export const parentOrAbove = requireRoles("admin", "teacher", "parent");
export const allAuthenticated = requireRoles("admin", "teacher", "student", "parent");
export function requireOwnership(config) {
    return async (c, next) => {
        const auth = c.get("auth");
        if (!auth) {
            throw new HTTPException(401, { message: "Authentication required" });
        }
        const userRole = auth.user.role;
        // Check if user role can bypass ownership check
        if (config.bypassRoles?.includes(userRole)) {
            await next();
            return;
        }
        // Get resource ID from params
        const resourceId = c.req.param("id") || c.req.param("studentId");
        if (!resourceId) {
            throw new HTTPException(400, { message: "Resource ID required" });
        }
        // For students: they can only access their own data
        if (userRole === "student") {
            if (resourceId !== auth.user.id) {
                throw new HTTPException(403, {
                    message: "Access denied. You can only access your own data.",
                });
            }
        }
        // For parents: they can access their children's data
        if (userRole === "parent") {
            // Check if the resourceId is one of their children
            const children = await db.users.findMany({
                parentId: auth.user.id
            });
            const childIds = children.map((child) => child.id);
            if (!childIds.includes(resourceId) && resourceId !== auth.user.id) {
                throw new HTTPException(403, {
                    message: "Access denied. You can only access your children's data.",
                });
            }
        }
        await next();
    };
}
// ============================================
// HELPER: Get accessible student IDs for current user
// ============================================
export async function getAccessibleStudentIds(auth) {
    const userRole = auth.user.role;
    // Admin and Teacher can access all students
    if (userRole === "admin" || userRole === "teacher") {
        return "all";
    }
    // Students can only access their own data
    if (userRole === "student") {
        return [auth.user.id];
    }
    // Parents can access their children's data
    if (userRole === "parent") {
        const children = await db.users.findMany({
            parentId: auth.user.id
        });
        return children.map((child) => child.id);
    }
    return [];
}
// ============================================
// HELPER: Check if user can access student data
// ============================================
export async function canAccessStudent(auth, studentId) {
    const accessibleIds = await getAccessibleStudentIds(auth);
    if (accessibleIds === "all") {
        return true;
    }
    return accessibleIds.includes(studentId);
}
