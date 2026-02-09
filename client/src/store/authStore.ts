import { create } from "zustand";

// Detect production environment
const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');

// Prioritize VITE_API_URL from environment, fallback to hardcoded production URL or localhost
const API_URL = (import.meta.env.VITE_API_URL || (isProduction ? "https://tahfidz-bootcamp-api.adzan.workers.dev" : "http://localhost:3000")).replace(/\/$/, "");

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "parent" | "student";
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  sessionExpiry: number | null;
  isLoading: boolean;
  error: string | null;

  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  verifyOtp: (email: string, otp: string) => Promise<boolean>;
  logout: () => void;
  checkSession: () => void;
  setError: (error: string | null) => void;
}

// Initialize from localStorage
const getInitialState = () => {
  try {
    const stored = localStorage.getItem("auth_storage");
    if (stored) {
      const parsed = JSON.parse(stored);
      const now = new Date().getTime();
      if (now < parsed.expiry) {
        return {
          user: parsed.user,
          token: parsed.token,
          isAuthenticated: true,
          sessionExpiry: parsed.expiry,
        };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    sessionExpiry: null,
  };
};

const initialState = getInitialState();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialState.user,
  isAuthenticated: initialState.isAuthenticated,
  token: initialState.token,
  sessionExpiry: initialState.sessionExpiry,
  isLoading: false,
  error: null,

  setError: (error) => set({ error }),

  loginWithPassword: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Login failed");
      }

      // Handle direct login success (Token received)
      const { user, token } = data.data;
      const expiry = new Date().getTime() + 4 * 60 * 60 * 1000; // 4 hours

      localStorage.setItem(
        "auth_storage",
        JSON.stringify({ user, token, expiry }),
      );

      set({
        user,
        token,
        isAuthenticated: true,
        sessionExpiry: expiry,
        isLoading: false
      });

      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Login failed",
      });
      return false;
    }
  },

  verifyOtp: async (email, otp) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }), // Backend expects 'code'
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Verification failed");
      }

      const { user, token } = data.data;
      const expiry = new Date().getTime() + 4 * 60 * 60 * 1000; // 4 hours

      localStorage.setItem(
        "auth_storage",
        JSON.stringify({ user, token, expiry }),
      );
      set({
        user,
        token,
        isAuthenticated: true,
        sessionExpiry: expiry,
        isLoading: false,
      });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Verification failed",
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("auth_storage");
    set({
      user: null,
      isAuthenticated: false,
      token: null,
      sessionExpiry: null,
      isLoading: false,
    });
  },

  checkSession: () => {
    const stored = localStorage.getItem("auth_storage");
    if (!stored) {
      set({
        user: null,
        isAuthenticated: false,
        token: null,
        sessionExpiry: null,
        isLoading: false,
      });
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      const now = new Date().getTime();

      if (now > parsed.expiry) {
        // Session expired
        localStorage.removeItem("auth_storage");
        set({
          user: null,
          isAuthenticated: false,
          token: null,
          sessionExpiry: null,
          isLoading: false,
        });
      } else {
        // Session valid
        set({
          user: parsed.user,
          isAuthenticated: true,
          token: parsed.token,
          sessionExpiry: parsed.expiry,
          isLoading: false,
        });
      }
    } catch {
      localStorage.removeItem("auth_storage");
      set({
        user: null,
        isAuthenticated: false,
        token: null,
        sessionExpiry: null,
        isLoading: false,
      });
    }
  },
}));
