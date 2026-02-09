import { z } from "zod";
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});
export const registerSchema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["admin", "teacher", "student", "parent"]).optional(),
    parentId: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
});
export const updateUserSchema = z.object({
    name: z.string().min(3).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    role: z.enum(["admin", "teacher", "student", "parent"]).optional(),
    isActive: z.boolean().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    // New fields for Teacher Profile
    nip: z.string().optional(),
    specialization: z.string().optional(),
    startDate: z.string().optional(),
    totalHafalan: z.number().or(z.string().transform(v => Number(v))).optional(),
});
