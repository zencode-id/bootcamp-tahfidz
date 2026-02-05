import { create } from "zustand";
import { useAuthStore } from "./authStore";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

export interface ClassData {
  id: string;
  name: string;
  schedule?: string;
  teacherId?: string;
  teacherName?: string;
  studentIds: string[];
  createdAt?: string;
}

interface ClassState {
  classes: ClassData[];
  isLoading: boolean;
  error: string | null;

  fetchClasses: () => Promise<void>;
  createClass: (data: Omit<ClassData, "id" | "createdAt">) => Promise<boolean>;
  updateClass: (id: string, data: Partial<ClassData>) => Promise<boolean>;
  deleteClass: (id: string) => Promise<boolean>;
  transferStudent: (fromClassId: string, studentId: string, toClassId: string) => Promise<boolean>;
  cleanupInactiveStudents: () => Promise<number>;
}

export const useClassStore = create<ClassState>((set, get) => ({
  classes: [],
  isLoading: false,
  error: null,

  fetchClasses: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;

      if (!token) {
        set({ error: "No authentication token found", isLoading: false });
        return;
      }

      const response = await fetch(`${API_URL}/classes?limit=1000`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        set({ classes: data.data || [] });
      } else {
        set({ error: data.message || "Failed to fetch classes" });
      }
    } catch (err: any) {
      set({ error: err.message || "Network error" });
    } finally {
      set({ isLoading: false });
    }
  },

  createClass: async (classData) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/classes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(classData),
      });

      const data = await response.json();

      if (data.success) {
        await get().fetchClasses();
        return true;
      } else {
        set({ error: data.message });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  updateClass: async (id, classData) => {
    set({ isLoading: true });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/classes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(classData),
      });

      const data = await response.json();
      if (data.success) {
        await get().fetchClasses();
        return true;
      } else {
        set({ error: data.message });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteClass: async (id) => {
    set({ isLoading: true });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/classes/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        await get().fetchClasses();
        return true;
      } else {
        set({ error: data.message });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  transferStudent: async (fromClassId, studentId, toClassId) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/classes/${fromClassId}/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ studentId, toClassId }),
      });

      const data = await response.json();
      if (data.success) {
        await get().fetchClasses();
        return true;
      } else {
        set({ error: data.message });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  cleanupInactiveStudents: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/classes/cleanup-inactive`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        await get().fetchClasses();
        return data.removedCount || 0;
      } else {
        set({ error: data.message });
        return 0;
      }
    } catch (err: any) {
      set({ error: err.message });
      return 0;
    } finally {
      set({ isLoading: false });
    }
  }
}));
