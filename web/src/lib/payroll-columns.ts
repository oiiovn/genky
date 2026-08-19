export type PayrollColumnKey =
  | "employee"
  | "position"
  | "totalHours"
  | "leaveDays"
  | "totalIncome"
  | "deduction"
  | "netIncome"
  | "paid"
  | "remaining"
  | "status";

export type PayrollColumnMeta = {
  key: PayrollColumnKey;
  label: string;
  defaultVisible: boolean;
  locked?: boolean;
  align?: "left" | "right";
  footer?: "hours" | "leave" | "income" | "deduction" | "net" | "paid" | "remaining";
};

export const PAYROLL_TABLE_COLUMNS: PayrollColumnMeta[] = [
  { key: "employee", label: "Nhân viên", defaultVisible: true, locked: true },
  { key: "position", label: "Chức vụ", defaultVisible: true },
  { key: "totalHours", label: "Tổng giờ", defaultVisible: true, align: "right", footer: "hours" },
  { key: "leaveDays", label: "Ngày nghỉ", defaultVisible: true, align: "right", footer: "leave" },
  { key: "totalIncome", label: "Tổng thu nhập", defaultVisible: true, align: "right", footer: "income" },
  { key: "deduction", label: "Khấu trừ", defaultVisible: true, align: "right", footer: "deduction" },
  { key: "netIncome", label: "Thực nhận", defaultVisible: true, align: "right", footer: "net" },
  { key: "paid", label: "Đã trả", defaultVisible: true, align: "right", footer: "paid" },
  { key: "remaining", label: "Còn lại", defaultVisible: true, align: "right", footer: "remaining" },
  { key: "status", label: "Trạng thái", defaultVisible: true },
];

export const PAYROLL_COLUMN_KEYS: PayrollColumnKey[] =
  PAYROLL_TABLE_COLUMNS.map((col) => col.key);

export const PAYROLL_DEFAULT_COLUMNS: PayrollColumnKey[] =
  PAYROLL_TABLE_COLUMNS.filter((col) => col.defaultVisible).map((col) => col.key);

export const PAYROLL_COLUMNS_STORAGE_KEY = "genky:payroll:table-columns";

const KEY_SET = new Set<string>(PAYROLL_COLUMN_KEYS);

export function normalizePayrollColumns(
  raw: unknown,
): PayrollColumnKey[] {
  const fromList = Array.isArray(raw)
    ? raw.filter((key): key is PayrollColumnKey =>
        typeof key === "string" && KEY_SET.has(key),
      )
    : [];
  const unique: PayrollColumnKey[] = [];
  for (const key of fromList) {
    if (!unique.includes(key)) unique.push(key);
  }
  if (!unique.includes("employee")) unique.unshift("employee");
  return unique.length > 0 ? unique : [...PAYROLL_DEFAULT_COLUMNS];
}

export function readPayrollColumnsFromStorage(): PayrollColumnKey[] {
  if (typeof window === "undefined") return [...PAYROLL_DEFAULT_COLUMNS];
  try {
    const raw = window.localStorage.getItem(PAYROLL_COLUMNS_STORAGE_KEY);
    if (!raw) return [...PAYROLL_DEFAULT_COLUMNS];
    return normalizePayrollColumns(JSON.parse(raw));
  } catch {
    return [...PAYROLL_DEFAULT_COLUMNS];
  }
}

export function writePayrollColumnsToStorage(keys: PayrollColumnKey[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PAYROLL_COLUMNS_STORAGE_KEY,
    JSON.stringify(normalizePayrollColumns(keys)),
  );
}

export function payrollColumnVisible(
  visible: PayrollColumnKey[],
  key: PayrollColumnKey,
): boolean {
  return visible.includes(key);
}
