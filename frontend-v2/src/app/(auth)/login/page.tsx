"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { KeyRound, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { LoginForm, LoginFormValues } from "@/components/auth/LoginForm";
import { AuthUI } from "@/components/ui/auth-ui";

// Modal specific schemas
const forcePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Temporary password is required."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters long.")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter.")
      .regex(/[0-9]/, "Must contain at least one number.")
      .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ForcePasswordFormValues = z.infer<typeof forcePasswordSchema>;

export default function AppLoginPage() {
  const [loading, setLoading] = useState(false);
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  const { login, forceChangePassword } = useAuth();
  const router = useRouter();

  const forceForm = useForm<ForcePasswordFormValues>({
    resolver: zodResolver(forcePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const handleLogin = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      const input = data.email.trim();
      const res = await login({ email: input, password: data.password });

      const accountRole = String(res?.user?.role || "").toLowerCase();
      const isTeacher = Boolean(res?.user?.isTeacher) || ["teacher", "faculty", "instructor"].includes(accountRole);
      const isAdmin = Boolean(res?.user?.isAdmin) || accountRole === "admin" || accountRole === "superadmin";

      if (res?.user?.forcePasswordChange) {
        forceForm.setValue("currentPassword", data.password);
        setShowForcePasswordModal(true);
      } else if (isAdmin) {
        window.location.href = "/admin/dashboard";
      } else if (isTeacher) {
        window.location.href = "/teacher/dashboard";
      } else if (res?.user?.isAssessmentStudent) {
        window.location.href = "/assessments";
      } else {
        window.location.href = "/dashboard";
      }
    } finally {
      setLoading(false);
    }
  };

  const onForcePasswordSubmit = async (data: ForcePasswordFormValues) => {
    setLoading(true);
    try {
      const res = await forceChangePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setPasswordChangeSuccess(true);
      setTimeout(() => {
        const isAssessment = res?.user?.isAssessmentStudent;
        router.push(isAssessment ? "/assessments" : "/dashboard");
      }, 1500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update password. Please try again.";
      forceForm.setError("root", {
        type: "manual",
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthUI
        signInContent={{
          image: {
            src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop",
            alt: "Students studying"
          },
          quote: {
            text: "Build your technical foundation. Master your skills securely.",
            author: "Chandigarh University"
          }
        }}
      >
        <div className="w-full max-w-[420px] flex flex-col gap-6 mx-auto px-4 sm:px-0">
          {/* Unified Login Box */}
          <div className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-sm p-6 sm:p-8 shadow-sm transition-all space-y-6">
            {/* Dual Co-Branding Header: CodeSkill Logo | CU Logo */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 select-none pt-1">
              {/* CodeSkill Logo + Wordmark */}
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 group transition-transform hover:scale-[1.02]"
              >
                <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-2xl overflow-hidden border border-black/10 dark:border-white/15 shadow-xs flex items-center justify-center p-0.5 group-hover:scale-105 transition-transform duration-200">
                  <img
                    src="/icon.svg"
                    alt="CodeSkill Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-bold text-2xl sm:text-[26px] tracking-tight leading-none text-foreground font-sans">
                  CodeSkill
                </span>
              </Link>

              {/* Divider */}
              <div className="h-9 sm:h-11 w-[1px] bg-border/80 shrink-0" aria-hidden="true" />

              {/* Chandigarh University Logo (Enlarged) */}
              <div
                className="h-[52px] sm:h-[60px] px-3.5 py-1.5 rounded-2xl overflow-hidden bg-white border border-border/70 shadow-xs flex items-center justify-center shrink-0 transition-transform hover:scale-[1.02]"
                title="Chandigarh University"
              >
                <img
                  src="/cu-logo-tight.png"
                  alt="Chandigarh University"
                  className="h-full w-auto object-contain"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-center flex flex-col items-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground text-center">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed text-center max-w-xs sm:max-w-sm">
                Sign in with your University UID or registered email to access your account.
              </p>
            </div>

            <LoginForm onSubmit={handleLogin} loading={loading} />
          </div>

          {/* Footer & Administrative Link */}
          <div className="flex flex-col gap-3 text-center">
            <p className="text-xs text-muted-foreground">
              By signing in, you agree to our{" "}
              <a href="#" className="underline font-medium hover:text-foreground transition-colors">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="underline font-medium hover:text-foreground transition-colors">
                Privacy Policy
              </a>.
            </p>

            <div className="pt-2 border-t border-border/40 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <Link
                href="/"
                className="group inline-flex items-center gap-1.5 font-medium hover:text-foreground transition-colors"
              >
                <span className="transition-transform group-hover:-translate-x-0.5">&larr;</span>
                <span>Return to Home</span>
              </Link>

              <span className="text-border/80">•</span>

              <Link
                href="/admin/login"
                className="inline-flex items-center gap-1.5 font-medium text-muted-foreground/80 hover:text-foreground transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Admin OTP</span>
              </Link>
            </div>
          </div>
        </div>
      </AuthUI>

      {/* Modal: First-Time Mandatory Password Change */}
      {showForcePasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Mandatory Password Setup
                </h3>
                <p className="text-xs text-muted-foreground">
                  This is your first login. You must set a permanent secure password before proceeding.
                </p>
              </div>
            </div>

            {passwordChangeSuccess ? (
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-emerald-400">
                  Password Updated Successfully!
                </h4>
                <p className="text-xs text-emerald-300">
                  Redirecting to your student assessment dashboard...
                </p>
              </div>
            ) : (
              <form
                onSubmit={forceForm.handleSubmit(onForcePasswordSubmit)}
                className="space-y-4"
              >
                {forceForm.formState.errors.root && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{forceForm.formState.errors.root.message}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Temporary / Initial Password
                  </label>
                  <input
                    type="password"
                    readOnly
                    className="w-full h-10 px-3 rounded-xl border border-border bg-muted/40 text-muted-foreground text-xs font-mono cursor-not-allowed"
                    {...forceForm.register("currentPassword")}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    New Permanent Password
                  </label>
                  <input
                    type="password"
                    placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special char"
                    className="w-full h-10 px-3 rounded-xl border border-border bg-muted/30 text-foreground text-xs focus:ring-2 focus:ring-primary outline-none"
                    {...forceForm.register("newPassword")}
                  />
                  {forceForm.formState.errors.newPassword && (
                    <p className="text-xs text-rose-400">
                      {forceForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Re-enter your new permanent password"
                    className="w-full h-10 px-3 rounded-xl border border-border bg-muted/30 text-foreground text-xs focus:ring-2 focus:ring-primary outline-none"
                    {...forceForm.register("confirmPassword")}
                  />
                  {forceForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-rose-400">
                      {forceForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-muted/30 border border-border/50 rounded-xl text-[11px] text-muted-foreground space-y-1">
                  <span className="font-semibold text-foreground block">Password Requirements:</span>
                  <p>• At least 8 characters long</p>
                  <p>• At least one uppercase letter (A-Z) and one number (0-9)</p>
                  <p>• At least one special symbol (!@#$%^&*)</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-primary/20 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Spinner className="w-4 h-4 animate-spin" /> Saving Password...
                    </>
                  ) : (
                    "Save Password & Enter Dashboard"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
