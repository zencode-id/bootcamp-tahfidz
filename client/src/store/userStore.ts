import { create } from "zustand";
import { useAuthStore } from "./authStore";

// Detect production environment
const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
const API_URL = isProduction
  ? "https://bootcamp-tahfidz.vercel.app"
  : (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "parent" | "student";
  isActive: boolean;
  phone?: string;
  address?: string;
  parentId?: string; // For students linked to parents
  createdAt?: string;
}

interface UserState {
  users: UserData[];
  isLoading: boolean;
  error: string | null;

  fetchUsers: () => Promise<void>;
  createUser: (data: Omit<UserData, "id" | "createdAt" | "isActive">) => Promise<boolean>;
  updateUser: (id: string, data: Partial<UserData>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {

      // Ensure we get the latest token from the store
      const token = useAuthStore.getState().token;

      console.log(`[userStore] Fetching users with token: ${token ? 'PRESENT' : 'MISSING'}`);

      if (!token) {
        set({ error: "No authentication token found" });
        return;
      }

      // Fetch all users (limit=1000) so client-side search works
      const response = await fetch(`${API_URL}/auth/users?limit=1000`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        set({ users: data.data });
      } else {
        set({ error: data.message || "Failed to fetch users" });
      }
    } catch (err: any) {
      set({ error: err.message || "Network error" });
    } finally {
      set({ isLoading: false });
    }
  },

  createUser: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      console.log('[createUser] Token:', token ? 'PRESENT' : 'MISSING');
      console.log('[createUser] Sending data:', userData);

      if (!token) {
        set({ error: "No authentication token. Please login again." });
        return false;
      }

      const response = await fetch(`${API_URL}/auth/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(userData),
      });

      console.log('[createUser] Response status:', response.status);
      const data = await response.json();
      console.log('[createUser] Response data:', data);

      if (data.success) {
        // Refresh list
        await get().fetchUsers();
        return true;
      } else {
        set({ error: data.message || data.error || "Failed to create user" });
        return false;
      }
    } catch (err: any) {
      console.error('[createUser] Error:', err);
      set({ error: err.message });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  updateUser: async (id, userData) => {
    set({ isLoading: true });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/auth/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      if (data.success) {
         await get().fetchUsers();
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

  deleteUser: async (id) => {
     set({ isLoading: true });
     try {
       const token = useAuthStore.getState().token;
       const response = await fetch(`${API_URL}/auth/users/${id}`, {
         method: "DELETE",
         headers: {
            "Authorization": `Bearer ${token}`
         }
       });

       const data = await response.json();
       if (data.success) {
         await get().fetchUsers();
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
  }

}));
