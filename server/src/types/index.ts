export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: "admin" | "teacher" | "student" | "parent";
  isActive: boolean;
  phone?: string;
  address?: string;
  parentId?: string;
  photoUrl?: string; // New field
  createdAt?: string;
  updatedAt?: string;
}

export interface TeacherProfile {
  id: string;
  userId: string;
  nip?: string;
  specialization?: string;
  startDate?: string;
  totalHafalan?: number;
  photoUrl?: string;
}
