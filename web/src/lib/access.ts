import type { RolePermissionCell } from "@/lib/roles-data";

export type AccessPayload = {
  role_label: string;
  membership_role: string | null;
  is_owner: boolean;
  employee_id?: number | null;
  employee?: {
    id: number;
    employee_code: string;
    full_name: string;
    branches: { id: number; name: string; is_primary: boolean }[];
  } | null;
  custom_role: {
    id: number;
    slug: string;
    name: string;
    is_default: boolean;
  } | null;
  permissions: Record<string, RolePermissionCell>;
};

export function canAccess(
  access: AccessPayload | null | undefined,
  resource: string,
  action: keyof RolePermissionCell = "view",
): boolean {
  if (!access) return false;
  if (access.is_owner) return true;
  return Boolean(access.permissions?.[resource]?.[action]);
}

export const NAV_PERMISSION: Record<string, { resource: string; action?: keyof RolePermissionCell }> = {
  "Tổng quan": { resource: "dashboard" },
  "Nhân viên": { resource: "employees" },
  "Ca làm": { resource: "shifts" },
  "Chấm công": { resource: "attendance" },
  "QR chấm công": { resource: "attendance" },
  "Lịch làm việc": { resource: "schedule" },
  "Bảng công": { resource: "timesheet" },
  Lương: { resource: "payroll" },
  "Thưởng / Phạt": { resource: "bonus" },
  "Nghỉ phép": { resource: "leave" },
  "Hiệu suất": { resource: "dashboard" },
  "Chi phí nhân sự": { resource: "payroll" },
  "Báo cáo": { resource: "dashboard" },
  "Cài đặt": { resource: "settings" },
  "Vai trò & Quyền": { resource: "roles" },
};

const FALLBACK_ROUTES: { resource: string; href: string }[] = [
  { resource: "dashboard", href: "/dashboard" },
  { resource: "attendance", href: "/attendance" },
  { resource: "schedule", href: "/schedule" },
  { resource: "shifts", href: "/shifts" },
  { resource: "employees", href: "/employees" },
  { resource: "timesheet", href: "/timesheet" },
  { resource: "payroll", href: "/payroll" },
  { resource: "bonus", href: "/adjustments" },
  { resource: "leave", href: "/leaves" },
  { resource: "settings", href: "/settings/general" },
];

export function firstAllowedPath(access: AccessPayload | null | undefined): string {
  if (!access) return "/login";
  if (access.is_owner) return "/dashboard";
  for (const route of FALLBACK_ROUTES) {
    if (canAccess(access, route.resource, "view")) return route.href;
  }
  return "/login";
}
