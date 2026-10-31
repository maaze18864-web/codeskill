"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { hasLabsAccess } from "@/lib/labs-access";
import { Spinner } from "@/components/ui/spinner";

export function LabsAccessBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = hasLabsAccess(user);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (!allowed) {
      router.replace(
        ["teacher", "faculty", "instructor"].includes(user.role)
          ? "/teacher/dashboard"
          : "/dashboard",
      );
    }
  }, [allowed, loading, pathname, router, user]);

  if (!loading && allowed) return children;

  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Checking Labs access">
      <Spinner className="h-6 w-6 text-primary" />
    </div>
  );
}
