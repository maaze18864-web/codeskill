"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { authAPI } from "@/config/api";

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  isAdmin?: boolean;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  registerSendOTP: (data: { email: string }) => Promise<any>;
  register: (data: any) => Promise<any>;
  login: (data: any) => Promise<any>;
  studentLogin: (data: { uid: string; password: string }) => Promise<any>;
  forceChangePassword: (data: { currentPassword: string; newPassword: string }) => Promise<any>;
  googleLogin: (token: string) => Promise<any>;
  adminLogin: (data: any) => Promise<any>;
  adminLoginVerify: (data: { email: string; otp: string }) => Promise<any>;
  forgotPassword: (data: { email: string }) => Promise<any>;
  resetPassword: (data: any) => Promise<any>;
  logout: () => void;
  updateProfile: (data: any) => Promise<void>;
  updateUserLocal: (updates: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user from token on mount
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("codeskill_token") : null;
    if (token) {
      authAPI
        .getMe()
        .then((res) => setUser(res.data.user))
        .catch(() => {
          if (typeof window !== "undefined") {
            localStorage.removeItem("codeskill_token");
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const clearSession = () => {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("codeskill_token");
        localStorage.removeItem("codeskill_refresh_token");
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        (event.key === "codeskill_token" || event.key === "codeskill_refresh_token") &&
        !event.newValue
      ) {
        clearSession();
      }
    };
    window.addEventListener("codeskill:session-expired", clearSession);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("codeskill:session-expired", clearSession);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const registerSendOTP = useCallback(async (data: { email: string }) => {
    try {
      setError(null);
      const res = await authAPI.registerSendOTP(data);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to send OTP";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const registerUser = useCallback(async (data: any) => {
    try {
      setError(null);
      const res = await authAPI.register(data);
      if (typeof window !== "undefined") {
        localStorage.setItem("codeskill_token", res.data.token);
        if (res.data.refreshToken) {
          localStorage.setItem("codeskill_refresh_token", res.data.refreshToken);
        }
      }
      setUser(res.data.user);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Registration failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const loginUser = useCallback(async (data: any) => {
    try {
      setError(null);
      const res = await authAPI.login(data);
      if (typeof window !== "undefined") {
        localStorage.setItem("codeskill_token", res.data.token);
        if (res.data.refreshToken) {
          localStorage.setItem("codeskill_refresh_token", res.data.refreshToken);
        }
      }
      setUser(res.data.user);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Login failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const studentLogin = useCallback(async (data: { uid: string; password: string }) => {
    try {
      setError(null);
      const res = await authAPI.studentLogin(data);
      if (typeof window !== "undefined") {
        localStorage.setItem("codeskill_token", res.data.token);
        if (res.data.refreshToken) {
          localStorage.setItem("codeskill_refresh_token", res.data.refreshToken);
        }
      }
      setUser(res.data.user);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Student login failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const forceChangePassword = useCallback(async (data: { currentPassword: string; newPassword: string }) => {
    try {
      setError(null);
      const res = await authAPI.forceChangePassword(data);
      if (typeof window !== "undefined") {
        if (res.data?.token) {
          localStorage.setItem("codeskill_token", res.data.token);
        }
        if (res.data?.refreshToken) {
          localStorage.setItem("codeskill_refresh_token", res.data.refreshToken);
        }
      }
      if (res.data?.user) {
        setUser((prev) => (prev ? { ...prev, ...res.data.user, forcePasswordChange: false } : prev));
      }
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to update password";
      setError(msg);
      throw new Error(msg);
    }
  }, []);


  const adminLogin = useCallback(async (data: any) => {
    try {
      setError(null);
      const res = await authAPI.adminLogin(data);
      if (res.data?.token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("codeskill_token", res.data.token);
          if (res.data.refreshToken) {
            localStorage.setItem("codeskill_refresh_token", res.data.refreshToken);
          }
        }
        setUser(res.data.user);
      }
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Admin login failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const adminLoginVerify = useCallback(async (data: { email: string; otp: string }) => {
    try {
      setError(null);
      const res = await authAPI.adminLoginVerify(data);
      if (typeof window !== "undefined") {
        localStorage.setItem("codeskill_token", res.data.token);
        if (res.data.refreshToken) {
          localStorage.setItem("codeskill_refresh_token", res.data.refreshToken);
        }
      }
      setUser(res.data.user);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "OTP verification failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const googleLoginUser = useCallback(async (token: string) => {
    try {
      setError(null);
      const res = await authAPI.googleLogin(token);
      if (typeof window !== "undefined") {
        localStorage.setItem("codeskill_token", res.data.token);
        if (res.data.refreshToken) {
          localStorage.setItem("codeskill_refresh_token", res.data.refreshToken);
        }
      }
      setUser(res.data.user);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Google login failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const forgotPassword = useCallback(async (data: { email: string }) => {
    try {
      setError(null);
      const res = await authAPI.forgotPassword(data);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to send reset link";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const resetPassword = useCallback(async (data: any) => {
    try {
      setError(null);
      const res = await authAPI.resetPassword(data);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to reset password";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logoutUser = useCallback(() => {
    if (typeof window !== "undefined") {
      const refreshToken = localStorage.getItem("codeskill_refresh_token");
      if (refreshToken) {
        authAPI.logout({ refreshToken }).catch(() => {});
      }
      localStorage.removeItem("codeskill_token");
      localStorage.removeItem("codeskill_refresh_token");
    }
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: any) => {
    try {
      const res = await authAPI.updateProfile(data);
      setUser((prev) => (prev ? { ...prev, ...res.data.user } : prev));
    } catch (err: any) {
      throw new Error(err.response?.data?.message || "Update failed");
    }
  }, []);

  const updateUserLocal = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        registerSendOTP,
        register: registerUser,
        login: loginUser,
        studentLogin,
        forceChangePassword,
        googleLogin: googleLoginUser,
        adminLogin,
        adminLoginVerify,
        forgotPassword,
        resetPassword,
        logout: logoutUser,
        updateProfile,
        updateUserLocal,
        isAuthenticated: !!user,
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

export default AuthContext;
