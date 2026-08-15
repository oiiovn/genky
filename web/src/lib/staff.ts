import type { MeResponse } from "@/lib/api";

export type StaffSession = {
  me: MeResponse;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  avatar: string | null;
  phone: string | null;
  branches: { id: number; name: string; is_primary: boolean }[];
  orgName: string;
};

export function isStaffAppUser(me: MeResponse): boolean {
  return (
    me.role === "employee" || me.access?.membership_role === "employee"
  );
}

export function staffSessionFromMe(me: MeResponse): StaffSession | null {
  const emp = me.access?.employee;
  const employeeId = me.access?.employee_id ?? emp?.id ?? null;
  if (!employeeId || !emp) return null;
  return {
    me,
    employeeId,
    employeeCode: emp.employee_code,
    fullName: emp.full_name,
    avatar: emp.avatar ?? me.user.avatar_url ?? null,
    phone: emp.phone ?? me.user.phone ?? null,
    branches: emp.branches ?? [],
    orgName: me.organization?.name ?? "Genky",
  };
}

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

export function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("vi-VN", { weekday: "short" });
}

export function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
