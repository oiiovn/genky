import type {
  TimesheetRow,
  TimesheetStats,
  TimesheetStatus,
} from "@/lib/timesheet-api";

export type {
  TimesheetRow,
  TimesheetShiftBadge,
  TimesheetStats,
  TimesheetStatus,
} from "@/lib/timesheet-api";

export {
  formatHours,
  formatMoney,
  monthBounds,
} from "@/lib/timesheet-api";

/** @deprecated Dùng API /timesheets — giữ để tương thích import cũ. */
export function buildTimesheetRows(): TimesheetRow[] {
  return [];
}

/** @deprecated Dùng stats từ API. */
export function computeTimesheetStats(): TimesheetStats {
  return {
    employees: 0,
    work_minutes: 0,
    ot_minutes: 0,
    avg_work_days: 0,
    estimated_cost: 0,
    employees_delta: 0,
    work_hours_delta: 0,
    ot_delta: 0,
    avg_days_delta: 0,
    cost_delta: 0,
  };
}
