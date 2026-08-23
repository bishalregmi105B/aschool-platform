"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, type ApiResponse } from "./api";

export interface User {
  id: string;
  role: string;
  full_name: string;
  full_name_nepali?: string;
  email?: string;
  phone: string;
  avatar_url?: string;
  preferred_language: string;
  permissions: Record<string, string[]>;
  school_id?: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  sendOtp: (phone: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      // Session lives in HttpOnly cookies; /auth/me is the source of truth.
      const res = await api.get<ApiResponse<User>>("/auth/me");
      if (res.data.success) {
        setUser(res.data.data);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await api.post<ApiResponse<{ access_token: string; refresh_token: string; user: User }>>(
      "/auth/login",
      { email, password }
    );
    if (!res.data.success) throw new Error(typeof res.data.error === "string" ? res.data.error : "Login failed");
    // Tokens are delivered as HttpOnly cookies by the backend — nothing JS-readable here.
    setUser(res.data.data.user);
  };

  const sendOtp = async (phone: string) => {
    const res = await api.post<ApiResponse>("/auth/send-otp", { phone });
    if (!res.data.success) throw new Error(typeof res.data.error === "string" ? res.data.error : "Failed to send OTP");
  };

  const loginWithOtp = async (phone: string, otp: string) => {
    const res = await api.post<ApiResponse<{ access_token: string; refresh_token: string; user: User }>>(
      "/auth/verify-otp",
      { phone, otp }
    );
    if (!res.data.success) throw new Error(typeof res.data.error === "string" ? res.data.error : "OTP verification failed");
    setUser(res.data.data.user);
  };

  const logout = () => {
    // Revoke server-side and clear HttpOnly cookies via the API.
    api.post("/auth/logout").catch(() => {}).finally(() => {
      setUser(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithOtp,
        sendOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
