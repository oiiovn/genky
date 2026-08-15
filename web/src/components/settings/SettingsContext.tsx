"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAdminShell } from "@/components/admin/AdminShell";
import {
  fetchBranches,
  fetchOrganization,
  type AuthOrganization,
  type AuthUser,
  type Branch,
} from "@/lib/api";
import { fetchEmployees, type Employee } from "@/lib/employees-api";
import { fetchShifts, type Shift } from "@/lib/shifts-api";
import type { ShellData } from "@/types/dashboard";

type SettingsContextValue = {
  shell: ShellData;
  headerData: ShellData;
  organization: AuthOrganization | null;
  user: AuthUser | null;
  branches: Branch[];
  employees: Employee[];
  shifts: Shift[];
  extrasLoading: boolean;
  ensureEmployeesAndShifts: () => void;
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
  const { shell: chrome, profile } = useAdminShell();
  const [shell, setShell] = useState<ShellData>(chrome);
  const [organization, setOrganizationState] =
    useState<AuthOrganization | null>(null);
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(false);
  const extrasRequested = useRef(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setShell(chrome);
  }, [chrome]);

  useEffect(() => {
    async function boot() {
      try {
        const [org, branchList] = await Promise.all([
          fetchOrganization().catch(() => null),
          fetchBranches().catch(() => [] as Branch[]),
        ]);
        setOrganizationState(org);
        setUserState(profile.user);
        setBranches(branchList);
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [profile.user]);

  const ensureEmployeesAndShifts = useCallback(() => {
    if (extrasRequested.current) return;
    extrasRequested.current = true;
    setExtrasLoading(true);
    void Promise.all([
      fetchEmployees({ per_page: 100 }).catch(() => ({
        data: [] as Employee[],
      })),
      fetchShifts({ per_page: 50 }).catch(() => ({
        data: [] as Shift[],
      })),
    ])
      .then(([empList, shiftList]) => {
        setEmployees(empList.data);
        setShifts(shiftList.data);
      })
      .catch(() => {
        extrasRequested.current = false;
      })
      .finally(() => setExtrasLoading(false));
  }, []);

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
    extrasLoading,
    ensureEmployeesAndShifts,
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
