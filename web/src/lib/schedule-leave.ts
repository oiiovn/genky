import type { LeaveRequest, LeaveType } from "@/lib/leave-api";
import { leaveTypeLabels } from "@/lib/leave-api";
import { addDays, toIsoDate } from "@/lib/schedule-utils";

export type ScheduleLeaveCell = {
  id: number;
  type: string;
  label: string;
};

export const leaveChipColor: Record<string, string> = {
  annual: "#8B5CF6",
  personal: "#0EA5E9",
  sick: "#F97316",
  unpaid: "#64748B",
};

export function leaveChipStyle(type: string): {
  background: string;
  color: string;
  borderColor: string;
} {
  const hex = leaveChipColor[type] ?? "#8B5CF6";
  return {
    background: `${hex}22`,
    color: hex,
    borderColor: `${hex}55`,
  };
}

export function eachIsoDate(from: string, to: string): string[] {
  if (!from || !to) return [];
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(toIsoDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function leavesByEmployeeDate(
  leaves: LeaveRequest[],
): Record<number, Record<string, ScheduleLeaveCell>> {
  const map: Record<number, Record<string, ScheduleLeaveCell>> = {};
  for (const leave of leaves) {
    const from = String(leave.from ?? "").slice(0, 10);
    const to = String(leave.to ?? "").slice(0, 10);
    if (leave.status !== "approved" || !from || !to) continue;
    if (!map[leave.employee_id]) map[leave.employee_id] = {};
    const cell: ScheduleLeaveCell = {
      id: leave.id,
      type: leave.type,
      label:
        leave.type_label ||
        leaveTypeLabels[leave.type as LeaveType] ||
        "Nghỉ phép",
    };
    for (const iso of eachIsoDate(from, to)) {
      map[leave.employee_id][iso] = cell;
    }
  }
  return map;
}
