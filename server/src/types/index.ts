export type UserRole = "admin" | "teacher" | "student" | "parent";

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  parentId?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Class {
  id: string;
  name: string;
  description?: string | null;
  teacherId?: string | null;
  schedule?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Attendance {
    id: string;
    studentId: string;
    classId?: string;
    sessionType: "subuh" | "ziyadah" | "murojaah" | "tahsin";
    status:  "present" | "absent" | "sick" | "leave" | "late";
    proofUrl?: string;
    notes?: string;
    date: string;
    recordedBy?: string;
    syncedAt?: string;
    syncSource?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface MemorizationLog {
    id: string;
    studentId: string;
    type: "ziyadah" | "murojaah";
    surahId: number;
    startAyah: number;
    endAyah: number;
    teacherId?: string;
    classId?: string;
    sessionDate: string;
    notes?: string;
    syncedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface OtpCode {
    id: string;
    userId: string;
    code: string;
    expiresAt: number; // Unix timestamp
    createdAt?: string;
    updatedAt?: string;
}

export interface ClassMember {
    id: string;
    classId: string;
    studentId: string;
    joinedAt: string;
    createdAt?: string;
    updatedAt?: string;
}
