import type { ScheduleAssignment } from "@/lib/schedule-api";
import type { Shift } from "@/lib/shifts-api";

export type UnderstaffedSlot = {
  key: string;
  date: string;
  branchId: number;
  branchName: string;
  shiftId: number;
  shiftName: string;
  shiftColor: string;
  capacity: number;
  assigned: number;
  missing: number;
};

/**
 * U2 understaffed slots: date + branch + shift where
 * assigned > 0 AND assigned < capacity AND capacity > 0.
 * O(assignments + slots). Does not invent empty slots.
 */
export function buildUnderstaffedSlots(
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  allowedDates?: ReadonlySet<string>,
): UnderstaffedSlot[] {
  const capacityByShift = new Map<number, { capacity: number; name: string; color: string }>();
  for (const shift of shifts) {
    const capacity = shift.capacity ?? 0;
    if (capacity > 0) {
      capacityByShift.set(shift.id, {
        capacity,
        name: shift.name,
        color: shift.color,
      });
    }
  }

  type Acc = {
    date: string;
    branchId: number;
    branchName: string;
    shiftId: number;
    shiftName: string;
    shiftColor: string;
    assigned: number;
  };

  const grouped = new Map<string, Acc>();

  for (const assignment of assignments) {
    const shiftId = assignment.shift?.id;
    const branchId = assignment.branch?.id;
    const date = assignment.date;
    if (!shiftId || !branchId || !date) continue;
    if (allowedDates && !allowedDates.has(date)) continue;

    const shiftMeta = capacityByShift.get(shiftId);
    if (!shiftMeta) continue;

    const key = `${date}|${branchId}|${shiftId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.assigned += 1;
    } else {
      grouped.set(key, {
        date,
        branchId,
        branchName: assignment.branch?.name ?? "—",
        shiftId,
        shiftName: assignment.shift?.name ?? shiftMeta.name,
        shiftColor: assignment.shift?.color ?? shiftMeta.color,
        assigned: 1,
      });
    }
  }

  const slots: UnderstaffedSlot[] = [];
  for (const [key, row] of grouped) {
    const meta = capacityByShift.get(row.shiftId);
    if (!meta) continue;
    if (row.assigned <= 0) continue;
    if (row.assigned >= meta.capacity) continue;
    slots.push({
      key,
      date: row.date,
      branchId: row.branchId,
      branchName: row.branchName,
      shiftId: row.shiftId,
      shiftName: row.shiftName,
      shiftColor: row.shiftColor,
      capacity: meta.capacity,
      assigned: row.assigned,
      missing: meta.capacity - row.assigned,
    });
  }

  slots.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.branchName !== b.branchName) {
      return a.branchName.localeCompare(b.branchName, "vi");
    }
    return a.shiftName.localeCompare(b.shiftName, "vi");
  });

  return slots;
}
