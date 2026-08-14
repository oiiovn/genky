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
import { useRouter } from "next/navigation";
import {
  fetchBranches,
  fetchDashboard,
  fetchOrganization,
  getAccessToken,
  me,
  type AuthOrganization,
  type AuthUser,
  type Branch,
} from "@/lib/api";
import { fetchEmployees, type Employee } from "@/lib/employees-api";
import { fetchShifts, type Shift } from "@/lib/shifts-api";
import type { DashboardData } from "@/types/dashboard";

type SettingsContextValue = {
  shell: DashboardData;
  headerData: DashboardData;
  organization: AuthOrganization | null;
  user: AuthUser | null;
  branches: Branch[];
  employees: Employee[];
  shifts: Shift[];
  employeeCount: number;
  toast: string | null;
  showToast: (msg: string) => void;
  setOrganization: (org: AuthOrganization) => void;
  setBranches: (branches: Branch[]) => void;
  setUser: (user: AuthUser) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettingsData() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettingsData phải dùng trong SettingsShell");
  }
  return ctx;
}

export function SettingsShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [shell, setShell] = useState<DashboardData | null>(null);
  const [organization, setOrganizationState] =
    useState<AuthOrganization | null>(null);
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      if (!getAccessToken()) {
        setLoading(false);
        router.replace("/login");
        return;
      }
      try {
        const profile = await me();
        if (profile.setup && !profile.setup.setup_completed) {
          setLoading(false);
          router.replace(
            profile.setup.next_step === "branch"
              ? "/onboarding/branch"
              : "/onboarding",
          );
          return;
        }
        const [dashboard, org, branchList, empList, shiftList] =
          await Promise.all([
            fetchDashboard(),
            fetchOrganization().catch(() => null),
            fetchBranches().catch(() => [] as Branch[]),
            fetchEmployees({ per_page: 100 }).catch(() => ({
              data: [] as Employee[],
              meta: {
                current_page: 1,
                last_page: 1,
                per_page: 100,
                total: 0,
              },
            })),
            fetchShifts({ per_page: 50 }).catch(() => ({
              data: [] as Shift[],
              meta: { current_page: 1, last_page: 1, per_page: 50, total: 0 },
            })),
          ]);
        setShell(dashboard);
        setOrganizationState(org);
        setUserState(profile.user);
        setBranches(branchList);
        setEmployees(empList.data);
        setShifts(shiftList.data);
        setEmployeeCount(empList.meta.total);
        setLoading(false);
      } catch {
        setLoading(false);
        router.replace("/login");
      }
    }
    void boot();
  }, [router]);

  const headerData = useMemo(() => {
    if (!shell) return null;
    return {
      ...shell,
      greeting: {
        ...shell.greeting,
        message: "Quản lý hệ thống và tùy chỉnh ứng dụng",
      },
    };
  }, [shell]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const setOrganization = useCallback((org: AuthOrganization) => {
    setOrganizationState(org);
    setShell((prev) =>
      prev
        ? {
            ...prev,
            tenant: {
              ...prev.tenant,
              name: org.name,
              logo_url: org.logo_url ?? prev.tenant.logo_url,
              has_logo: Boolean(org.logo_url),
            },
          }
        : prev,
    );
  }, []);

  const setUser = useCallback((next: AuthUser) => {
    setUserState(next);
    setShell((prev) =>
      prev
        ? { ...prev, greeting: { ...prev.greeting, name: next.name } }
        : prev,
    );
  }, []);

  if (loading || !shell || !headerData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] text-slate-500">
        Đang tải...
      </div>
    );
  }

  const value: SettingsContextValue = {
    shell,
    headerData,
    organization,
    user,
    branches,
    employees,
    shifts,
    employeeCount,
    toast,
    showToast,
    setOrganization,
    setBranches,
    setUser,
  };

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}
