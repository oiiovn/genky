"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { PageLoadingSkeleton } from "@/components/ui/PageLoadingSkeleton";
import {
  clearTokens,
  fetchShell,
  getAccessToken,
  me,
  refreshMe,
  refreshShell,
  branchesFromShell,
  type Branch,
  type MeResponse,
} from "@/lib/api";
import { describeFetchError, isNetworkError } from "@/lib/api-base";
import { hardReplace } from "@/lib/nav";
import { isStaffAppUser } from "@/lib/staff";
import type { ShellData } from "@/types/dashboard";

type AdminShellContextValue = {
  profile: MeResponse;
  shell: ShellData;
  refreshProfile: () => Promise<MeResponse>;
  refreshShell: () => Promise<ShellData>;
};

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

const ADMIN_PREFIXES = [
  "/dashboard",
  "/employees",
  "/attendance",
  "/shifts",
  "/schedule",
  "/timesheet",
  "/payroll",
  "/adjustments",
  "/leaves",
  "/marketing",
  "/roles",
  "/settings",
  "/upgrade",
];

function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function useAdminShell(): AdminShellContextValue {
  const value = useContext(AdminShellContext);
  if (!value) throw new Error("useAdminShell phải dùng trong AdminShell");
  return value;
}

export function useAdminChrome(message?: string): AdminShellContextValue & {
  branches: Branch[];
  headerData: ShellData;
} {
  const ctx = useAdminShell();
  const branches = useMemo(() => branchesFromShell(ctx.shell), [ctx.shell]);
  const headerData = useMemo(
    () =>
      message
        ? {
            ...ctx.shell,
            greeting: { ...ctx.shell.greeting, message },
          }
        : ctx.shell,
    [ctx.shell, message],
  );

  return { ...ctx, branches, headerData };
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const adminPath = isAdminPath(pathname);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [shell, setShell] = useState<ShellData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const boot = useCallback(async (force = false) => {
    if (!getAccessToken()) {
      hardReplace("/login");
      return null;
    }

    try {
      const [next, chrome] = await Promise.all([
        force ? refreshMe() : me(),
        force ? refreshShell() : fetchShell(),
      ]);

      if (next.setup && !next.setup.setup_completed) {
        hardReplace(
          next.setup.next_step === "branch"
            ? "/onboarding/branch"
            : "/onboarding",
        );
        return null;
      }
      if (isStaffAppUser(next)) {
        hardReplace("/m");
        return null;
      }

      setProfile(next);
      setShell(chrome);
      setLoading(false);
      return next;
    } catch (err) {
      const message = describeFetchError(err);
      if (isNetworkError(err) || message.startsWith("Không kết nối")) {
        setError(message);
        setLoading(false);
        return null;
      }

      clearTokens();
      hardReplace("/login");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!adminPath) return;
    // boot đồng bộ session từ API vào context khi vào khu vực quản trị.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void boot();
  }, [adminPath, boot]);

  const value = useMemo<AdminShellContextValue | null>(() => {
    if (!profile || !shell) return null;
    return {
      profile,
      shell,
      refreshProfile: async () => {
        const next = await boot(true);
        if (!next) throw new Error("Không tải được thông tin tài khoản.");
        return next;
      },
      refreshShell: async () => {
        const next = await refreshShell();
        setShell(next);
        return next;
      },
    };
  }, [profile, shell, boot]);

  if (!adminPath) return children;
  if (loading) return <PageLoadingSkeleton />;

  if (error || !value) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F3F4F6] px-6 text-center">
        <p className="text-sm text-rose-600">
          {error ?? "Không tải được thông tin tài khoản."}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            void boot(true);
          }}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <AdminShellContext.Provider value={value}>
      <div className="flex min-h-screen bg-[#F3F4F6]">
        <Sidebar tenant={value.shell.tenant} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header data={value.shell} />
          {children}
        </div>
      </div>
    </AdminShellContext.Provider>
  );
}
