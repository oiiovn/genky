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
import {
  clearTokens,
  getAccessToken,
  logout as apiLogout,
  me,
  refreshMe,
} from "@/lib/api";
import { describeFetchError, isNetworkError } from "@/lib/api-base";
import { hardReplace } from "@/lib/nav";
import {
  isStaffAppUser,
  staffSessionFromMe,
  type StaffSession,
} from "@/lib/staff";
import { StaffBottomNav } from "@/components/staff/StaffBottomNav";

type StaffContextValue = {
  session: StaffSession;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const StaffContext = createContext<StaffContextValue | null>(null);

export function useStaff(): StaffContextValue {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff phải dùng trong StaffShell");
  return ctx;
}

export function StaffShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const boot = useCallback(async (force = false) => {
    if (!getAccessToken()) {
      hardReplace("/login");
      return;
    }
    try {
      const profile = force ? await refreshMe() : await me();
      if (!isStaffAppUser(profile)) {
        hardReplace("/dashboard");
        return;
      }
      const next = staffSessionFromMe(profile);
      if (!next) {
        setError(
          "Tài khoản chưa gắn hồ sơ nhân viên. Liên hệ quản trị viên.",
        );
        setSession(null);
        setLoading(false);
        return;
      }
      setSession(next);
      setError(null);
      setLoading(false);
    } catch (err) {
      const msg = describeFetchError(err);
      if (isNetworkError(err) || msg.startsWith("Không kết nối")) {
        setError(msg);
        setLoading(false);
        return;
      }
      clearTokens();
      hardReplace("/login");
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  const value = useMemo<StaffContextValue | null>(() => {
    if (!session) return null;
    return {
      session,
      refresh: async () => {
        await boot(true);
      },
      logout: async () => {
        await apiLogout();
        hardReplace("/login");
      },
    };
  }, [session, boot]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0B1220] text-slate-300">
        Đang mở Genky Staff...
      </div>
    );
  }

  if (error || !value) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0B1220] px-6 text-center">
        <p className="text-sm text-rose-300">{error ?? "Không tải được."}</p>
        <button
          type="button"
          onClick={() => {
            void apiLogout().then(() => {
              hardReplace("/login");
            });
          }}
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white"
        >
          Đăng nhập lại
        </button>
      </div>
    );
  }

  const hideNav = pathname?.startsWith("/m/scan");

  return (
    <StaffContext.Provider value={value}>
      <div className="min-h-dvh bg-[radial-gradient(120%_80%_at_50%_-10%,#1e3a5f_0%,#0B1220_55%)] text-slate-100">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <div className={hideNav ? "flex-1" : "flex-1 pb-24"}>{children}</div>
          {!hideNav ? <StaffBottomNav /> : null}
        </div>
      </div>
    </StaffContext.Provider>
  );
}
