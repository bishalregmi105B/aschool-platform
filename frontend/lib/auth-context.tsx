"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Cookies from "js-cookie";
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
      const token = Cookies.get("access_token");
      if (!token) {
        setUser(null);
        return;
      }
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
    const { access_token, refresh_token, user: userData } = res.data.data;
    Cookies.set("access_token", access_token, { sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    Cookies.set("refresh_token", refresh_token, { sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    setUser(userData);
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
    const { access_token, refresh_token, user: userData } = res.data.data;
    Cookies.set("access_token", access_token, { sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    Cookies.set("refresh_token", refresh_token, { sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    setUser(userData);
  };

  const logout = () => {
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
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
