import { getAccessToken } from "@/lib/api";
import type { Employee } from "@/lib/employees-api";
import { monthBounds } from "@/lib/timesheet-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type PayrollStatus = "paid" | "pending" | "draft" | "partial";

export type PayrollRow = {
  id: number;
  employee: Employee;
  department: string;
  position: string;
  total_minutes: number;
  leave_days?: number;
  paid_leave_days?: number;
  unpaid_days?: number;
  income: number;
  deductions: number;
  net: number;
  paid_amount: number;
  remaining: number;
  status: PayrollStatus;
  branch_ids: number[];
  paid_at?: string | null;
};

export type PayrollStats = {
  employees: number;
  fund: number;
  income: number;
  deductions: number;
  paid_percent: number;
  fund_delta: number;
  income_delta: number;
  deductions_delta: number;
};

export type DepartmentCost = {
  name: string;
  value: number;
  color: string;
};

export type PayrollListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  year: number;
  month: number;
  from: string;
  to: string;
  label: string;
};

export type PayrollListResponse = {
  data: PayrollRow[];
  meta: PayrollListMeta;
  stats: PayrollStats;
  summary: { paid: number; pending: number };
  departments: string[];
  department_costs: DepartmentCost[];
};

export type PayrollFilters = {
  year: number;
  month: number;
  branch_id?: number | "";
  department?: string;
  status?: "" | PayrollStatus;
  search?: string;
  page?: number;
  per_page?: number;
};

export { monthBounds };

function authHeaders(json = true): HeadersInit {
  const access = getAccessToken();
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
  };
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data.errors) {
      const first = Object.values(data.errors as Record<string, string[]>)[0];
      if (first?.[0]) return first[0];
    }
    if (data.message) return data.message as string;
  } catch {
    /* ignore */
  }
  return "Có lỗi xảy ra, vui lòng thử lại.";
}

function toQuery(filters: PayrollFilters): URLSearchParams {
  const q = new URLSearchParams();
  q.set("year", String(filters.year));
  q.set("month", String(filters.month));
  if (filters.branch_id) q.set("branch_id", String(filters.branch_id));
  if (filters.department) q.set("department", filters.department);
  if (filters.status) q.set("status", filters.status);
  if (filters.search) q.set("search", filters.search);
  if (filters.page) q.set("page", String(filters.page));
  q.set("per_page", String(filters.per_page ?? 10));
  return q;
}

export function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  return `${h.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h`;
}

export function averageNet(rows: PayrollRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((s, r) => s + r.net, 0) / rows.length;
}

export async function fetchPayrolls(
  filters: PayrollFilters,
): Promise<PayrollListResponse> {
  const res = await fetch(`${API_URL}/payrolls?${toQuery(filters)}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function generatePayroll(payload: {
  year: number;
  month: number;
  branch_id?: number | null;
}): Promise<{ created: number; updated: number; total_employees: number }> {
  const res = await fetch(`${API_URL}/payrolls/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data;
}

export async function markPayrollPaid(payload: {
  year: number;
  month: number;
  employee_ids: number[];
  status?: PayrollStatus;
}): Promise<{ count: number; status: PayrollStatus }> {
  const res = await fetch(`${API_URL}/payrolls/mark-paid`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data;
}

export async function exportPayrolls(
  filters: Omit<PayrollFilters, "page" | "per_page">,
): Promise<void> {
  const q = toQuery({ ...filters, page: 1, per_page: 1 });
  q.delete("page");
  q.delete("per_page");
  const res = await fetch(`${API_URL}/payrolls/export?${q}`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll-${filters.year}-${String(filters.month).padStart(2, "0")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export type PayrollPayMethod = "cash" | "bank" | "transfer" | "other";

export async function payPayroll(payload: {
  year: number;
  month: number;
  employee_id: number;
  amount: number;
  method: PayrollPayMethod;
  content?: string;
}): Promise<{
  payment: {
    id: number;
    employee_id: number;
    amount: number;
    method: string;
    content: string | null;
    paid_at: string | null;
  };
  entry: {
    employee_id: number;
    net: number;
    paid_amount: number;
    remaining: number;
    status: PayrollStatus;
  };
}> {
  const res = await fetch(`${API_URL}/payrolls/pay`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data;
}

export type PayrollPaymentGroup = {
  employee_id: number;
  employee: Employee | null;
  department: string;
  payments_count: number;
  total_paid: number;
  last_paid_at: string | null;
  payments: {
    id: number;
    year: number;
    month: number;
    label: string;
    amount: number;
    method: string;
    content: string | null;
    paid_by: string | null;
    paid_at: string | null;
  }[];
};

export async function fetchPayrollPayments(params: {
  year?: number | "";
  month?: number | "";
  branch_id?: number | "";
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<{
  data: PayrollPaymentGroup[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}> {
  const q = new URLSearchParams();
  if (params.year) q.set("year", String(params.year));
  if (params.month) q.set("month", String(params.month));
  if (params.branch_id) q.set("branch_id", String(params.branch_id));
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  q.set("per_page", String(params.per_page ?? 20));
  const res = await fetch(`${API_URL}/payrolls/payments?${q}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export type PayrollSheetStatus = "completed" | "partial" | "pending";

export type PayrollHistorySheet = {
  id: string;
  year: number;
  month: number;
  label: string;
  from: string;
  to: string;
  employees: number;
  paid_count: number;
  pending_count: number;
  income: number;
  deductions: number;
  fund: number;
  status: PayrollSheetStatus;
  created_at: string | null;
  last_paid_at: string | null;
};

export type PayrollHistoryDetailRow = {
  id: number;
  employee_id: number;
  employee: Employee;
  department: string;
  position: string;
  total_minutes: number;
  income: number;
  deductions: number;
  net: number;
  status: PayrollStatus;
  paid_at: string | null;
  paid_by: string | null;
  created_at: string | null;
};

export async function fetchPayrollHistory(params: {
  year?: number | "";
  branch_id?: number | "";
  status?: "" | PayrollSheetStatus;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<{
  data: PayrollHistorySheet[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}> {
  const q = new URLSearchParams();
  if (params.year) q.set("year", String(params.year));
  if (params.branch_id) q.set("branch_id", String(params.branch_id));
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  q.set("per_page", String(params.per_page ?? 12));
  const res = await fetch(`${API_URL}/payrolls/history?${q}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchPayrollHistoryDetail(
  year: number,
  month: number,
  branchId?: number | "",
): Promise<{
  sheet: PayrollHistorySheet;
  data: PayrollHistoryDetailRow[];
}> {
  const q = new URLSearchParams();
  if (branchId) q.set("branch_id", String(branchId));
  const res = await fetch(
    `${API_URL}/payrolls/history/${year}/${month}?${q}`,
    {
      headers: authHeaders(false),
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
