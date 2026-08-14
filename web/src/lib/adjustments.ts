import type { Employee } from "@/lib/employees-api";
import { monthBounds } from "@/lib/timesheet";

export type AdjustmentType = "reward" | "penalty";

export type AdjustmentCategory =
  | "personal_reward"
  | "team_reward"
  | "kpi_reward"
  | "discipline"
  | "late"
  | "other_penalty";

export type AdjustmentRecord = {
  id: number;
  employee_id: number;
  employee_code: string;
  full_name: string;
  avatar: string | null;
  department: string;
  type: AdjustmentType;
  category: AdjustmentCategory;
  reason: string;
  amount: number;
  date: string;
  created_by: string;
  branch_ids: number[];
};

export type AdjustmentStats = {
  reward_total: number;
  penalty_total: number;
  recorded_total: number;
  rewarded_employees: number;
  penalized_employees: number;
  reward_delta: number;
  penalty_delta: number;
  recorded_delta: number;
};

export { monthBounds };

export const CATEGORY_LABELS: Record<AdjustmentCategory, string> = {
  personal_reward: "Thưởng cá nhân",
  team_reward: "Thưởng tập thể",
  kpi_reward: "Thưởng KPI",
  discipline: "Phạt kỷ luật",
  late: "Phạt đi trễ",
  other_penalty: "Phạt khác",
};

export const CATEGORY_COLORS: Record<AdjustmentCategory, string> = {
  personal_reward: "#10B981",
  team_reward: "#3B82F6",
  kpi_reward: "#8B5CF6",
  discipline: "#F43F5E",
  late: "#F59E0B",
  other_penalty: "#64748B",
};

const REWARD_REASONS = [
  { category: "personal_reward" as const, reason: "Hoàn thành xuất sắc KPI", amount: 1500000 },
  { category: "personal_reward" as const, reason: "Nhân viên xuất sắc tháng", amount: 2000000 },
  { category: "team_reward" as const, reason: "Thưởng doanh số chi nhánh", amount: 800000 },
  { category: "kpi_reward" as const, reason: "Đạt chỉ tiêu quý", amount: 1200000 },
];

const PENALTY_REASONS = [
  { category: "late" as const, reason: "Đi trễ 3 lần trong tháng", amount: 200000 },
  { category: "discipline" as const, reason: "Vi phạm nội quy", amount: 500000 },
  { category: "other_penalty" as const, reason: "Thiếu sót quy trình", amount: 300000 },
  { category: "discipline" as const, reason: "Không đúng đồng phục", amount: 100000 },
];

export function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function seedAdjustments(
  employees: Employee[],
  year: number,
  month: number,
  createdBy = "Admin",
): AdjustmentRecord[] {
  if (employees.length === 0) return [];
  const { from } = monthBounds(year, month);
  const records: AdjustmentRecord[] = [];
  let id = 1;

  employees.forEach((emp, index) => {
    if (index % 2 === 0) {
      const r = REWARD_REASONS[index % REWARD_REASONS.length];
      const day = String((index % 25) + 1).padStart(2, "0");
      records.push({
        id: id++,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        avatar: emp.avatar,
        department: emp.position?.name ?? "—",
        type: "reward",
        category: r.category,
        reason: r.reason,
        amount: r.amount + (index % 3) * 100000,
        date: `${from.slice(0, 8)}${day}`,
        created_by: createdBy,
        branch_ids: emp.branches.map((b) => b.id),
      });
    }
    if (index % 3 === 0) {
      const p = PENALTY_REASONS[index % PENALTY_REASONS.length];
      const day = String((index % 20) + 5).padStart(2, "0");
      records.push({
        id: id++,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        avatar: emp.avatar,
        department: emp.position?.name ?? "—",
        type: "penalty",
        category: p.category,
        reason: p.reason,
        amount: p.amount + (index % 2) * 50000,
        date: `${from.slice(0, 8)}${day}`,
        created_by: createdBy,
        branch_ids: emp.branches.map((b) => b.id),
      });
    }
  });

  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export function computeAdjustmentStats(
  records: AdjustmentRecord[],
): AdjustmentStats {
  const rewards = records.filter((r) => r.type === "reward");
  const penalties = records.filter((r) => r.type === "penalty");
  const reward_total = rewards.reduce((s, r) => s + r.amount, 0);
  const penalty_total = penalties.reduce((s, r) => s + r.amount, 0);
  return {
    reward_total,
    penalty_total,
    recorded_total: reward_total + penalty_total,
    rewarded_employees: new Set(rewards.map((r) => r.employee_id)).size,
    penalized_employees: new Set(penalties.map((r) => r.employee_id)).size,
    reward_delta: 12.5,
    penalty_delta: -5.3,
    recorded_delta: 8.7,
  };
}

export function categoryBreakdown(records: AdjustmentRecord[]) {
  const map = new Map<AdjustmentCategory, number>();
  for (const r of records) {
    map.set(r.category, (map.get(r.category) ?? 0) + r.amount);
  }
  const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1;
  return Array.from(map.entries())
    .map(([category, value]) => ({
      category,
      name: CATEGORY_LABELS[category],
      value,
      color: CATEGORY_COLORS[category],
      percent: (value / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

export function topEmployees(
  records: AdjustmentRecord[],
  type: AdjustmentType,
  limit = 3,
) {
  const map = new Map<
    number,
    { employee_id: number; full_name: string; avatar: string | null; department: string; amount: number }
  >();
  for (const r of records.filter((x) => x.type === type)) {
    const cur = map.get(r.employee_id);
    if (cur) cur.amount += r.amount;
    else {
      map.set(r.employee_id, {
        employee_id: r.employee_id,
        full_name: r.full_name,
        avatar: r.avatar,
        department: r.department,
        amount: r.amount,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
