"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AssignShiftModal } from "@/components/schedule/AssignShiftModal";
import { ScheduleSidePanel } from "@/components/schedule/ScheduleSidePanel";
import {
  ScheduleToolbar,
  type ScheduleViewMode,
} from "@/components/schedule/ScheduleToolbar";
import {
  ScheduleWeekGrid,
  type ScheduleRow,
} from "@/components/schedule/ScheduleWeekGrid";
import {
  fetchBranches,
  fetchDashboard,
  getAccessToken,
  me,
  type Branch,
} from "@/lib/api";
import { fetchEmployees, type Employee } from "@/lib/employees-api";
import {
  createScheduleAssignment,
  deleteScheduleAssignment,
  fetchScheduleAssignments,
  type ScheduleAssignment,
} from "@/lib/schedule-api";
import {
  addDays,
  buildWeekDays,
  minutesBetween,
  startOfWeek,
  toIsoDate,
} from "@/lib/schedule-utils";
import { fetchShifts, type Shift } from "@/lib/shifts-api";
import type { DashboardData } from "@/types/dashboard";
import { nowInAppTz, todayIso } from "@/lib/timezone";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function SchedulePage() {
  const router = useRouter();
  const [shell, setShell] = useState<DashboardData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [view, setView] = useState<ScheduleViewMode>("week");
  const [anchor, setAnchor] = useState(() => startOfWeek(nowInAppTz()));
  const [branchId, setBranchId] = useState<number | "">("");
  const [shiftId, setShiftId] = useState<number | "">("");
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [search, setSearch] = useState("");

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmployee, setAssignEmployee] = useState<Employee | null>(null);
  const [assignDate, setAssignDate] = useState<string | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<ScheduleAssignment | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);

  const weekDays = useMemo(() => buildWeekDays(anchor, todayIso()), [anchor]);
  const rangeFrom = weekDays[0]?.iso ?? toIsoDate(anchor);
  const rangeTo = weekDays[6]?.iso ?? toIsoDate(addDays(anchor, 6));

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadAssignments = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const data = await fetchScheduleAssignments({
        branch_id: branchId,
        shift_id: shiftId,
        employee_id: employeeId,
        date_from: rangeFrom,
        date_to: rangeTo,
        status: "assigned",
      });
      setAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được lịch.");
    } finally {
      setListLoading(false);
    }
  }, [branchId, shiftId, employeeId, rangeFrom, rangeTo]);

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
        const [dashboard, branchList, shiftList, empList] = await Promise.all([
          fetchDashboard(),
          fetchBranches().catch(() => [] as Branch[]),
          fetchShifts({ status: "active", per_page: 50 }).catch(() => ({
            data: [] as Shift[],
            meta: { current_page: 1, last_page: 1, per_page: 50, total: 0 },
          })),
          fetchEmployees({ status: "active", per_page: 100 }).catch(() => ({
            data: [] as Employee[],
            meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
          })),
        ]);
        setShell(dashboard);
        setBranches(branchList);
        setShifts(shiftList.data);
        setEmployees(empList.data);
        setLoading(false);
      } catch {
        setLoading(false);
        router.replace("/login");
      }
    }
    void boot();
  }, [router]);

  useEffect(() => {
    if (!shell) return;
    void loadAssignments();
  }, [shell, loadAssignments]);

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (branchId) {
      list = list.filter((e) =>
        e.branches.some((b) => b.id === branchId),
      );
    }
    if (employeeId) {
      list = list.filter((e) => e.id === employeeId);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.full_name.toLowerCase().includes(q) ||
          e.employee_code.toLowerCase().includes(q) ||
          (e.position?.name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [employees, branchId, employeeId, search]);

  const rows: ScheduleRow[] = useMemo(() => {
    return filteredEmployees.map((employee) => {
      const byDate: Record<string, ScheduleAssignment[]> = {};
      let minutes = 0;
      for (const a of assignments) {
        if (a.employee?.id !== employee.id) continue;
        if (shiftId && a.shift?.id !== shiftId) continue;
        const key = a.date;
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(a);
        if (a.shift) {
          minutes += minutesBetween(a.shift.start_time, a.shift.end_time);
        }
      }
      return { employee, byDate, minutes };
    });
  }, [filteredEmployees, assignments, shiftId]);

  const overview = useMemo(() => {
    const byShiftMap = new Map<number, { shift: Shift; count: number }>();
    for (const s of shifts) {
      byShiftMap.set(s.id, { shift: s, count: 0 });
    }
    let totalMinutes = 0;
    for (const a of assignments) {
      if (!a.shift) continue;
      const entry = byShiftMap.get(a.shift.id);
      if (entry) entry.count += 1;
      else {
        byShiftMap.set(a.shift.id, {
          shift: {
            id: a.shift.id,
            branch_id: null,
            name: a.shift.name,
            code: a.shift.code,
            start_time: a.shift.start_time,
            end_time: a.shift.end_time,
            crosses_midnight: false,
            duration_minutes: minutesBetween(a.shift.start_time, a.shift.end_time),
            break_minutes: 0,
            break_time: 0,
            total_minutes: minutesBetween(a.shift.start_time, a.shift.end_time),
            color: a.shift.color,
            icon: null,
            description: null,
            capacity: null,
            status: "active",
            employee_count: 0,
            is_ongoing: false,
          },
          count: 1,
        });
      }
      totalMinutes += minutesBetween(a.shift.start_time, a.shift.end_time);
    }

    let offDays = 0;
    let unscheduledEmployees = 0;
    for (const row of rows) {
      let hasAny = false;
      for (const day of weekDays) {
        const cells = row.byDate[day.iso] ?? [];
        if (cells.length === 0) offDays += 1;
        else hasAny = true;
      }
      if (!hasAny) unscheduledEmployees += 1;
    }

    const understaffedShifts = shifts.filter((s) => {
      const count = byShiftMap.get(s.id)?.count ?? 0;
      return (s.capacity ?? 0) > 0 && count < (s.capacity ?? 0);
    }).length;

    return {
      totalAssignments: assignments.length,
      totalMinutes,
      byShift: shifts.map((shift) => ({
        shift,
        count: byShiftMap.get(shift.id)?.count ?? 0,
      })),
      offDays,
      unscheduledEmployees,
      understaffedShifts,
    };
  }, [assignments, shifts, rows, weekDays]);

  const headerData = useMemo(() => {
    if (!shell) return null;
    return {
      ...shell,
      greeting: {
        ...shell.greeting,
        message: "Quản lý lịch làm việc của nhân viên",
      },
    };
  }, [shell]);

  async function handleAssign(payload: {
    shift_id: number;
    branch_id: number;
    note?: string;
  }) {
    if (!assignEmployee || !assignDate) return;
    setAssignSaving(true);
    setAssignError(null);
    try {
      await createScheduleAssignment({
        employee_id: assignEmployee.id,
        shift_id: payload.shift_id,
        branch_id: payload.branch_id,
        date: assignDate,
        note: payload.note,
      });
      setAssignOpen(false);
      setAssignEmployee(null);
      setAssignDate(null);
      showToast("Đã phân ca thành công");
      await loadAssignments();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Phân ca thất bại.");
    } finally {
      setAssignSaving(false);
    }
  }

  async function handleRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await deleteScheduleAssignment(pendingRemove.id);
      setPendingRemove(null);
      showToast("Đã gỡ ca khỏi lịch");
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gỡ ca.");
    } finally {
      setRemoving(false);
    }
  }

  if (loading || !shell || !headerData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] text-slate-500">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      <Sidebar tenant={shell.tenant} active="Lịch làm việc" access={shell.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          data={headerData}
          subtitle="Quản lý lịch làm việc của nhân viên"
        />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <ScheduleToolbar
            view={view}
            onViewChange={setView}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            onPrev={() => setAnchor((d) => addDays(startOfWeek(d), -7))}
            onNext={() => setAnchor((d) => addDays(startOfWeek(d), 7))}
            onToday={() => setAnchor(startOfWeek(nowInAppTz()))}
            branches={branches}
            shifts={shifts}
            employees={employees}
            branchId={branchId}
            shiftId={shiftId}
            employeeId={employeeId}
            search={search}
            onBranchChange={setBranchId}
            onShiftChange={setShiftId}
            onEmployeeChange={setEmployeeId}
            onSearchChange={setSearch}
          />

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-5 xl:flex-row">
            <div className="min-w-0 flex-1">
              {view === "week" ? (
                <ScheduleWeekGrid
                  days={weekDays}
                  rows={rows}
                  legendShifts={shifts}
                  loading={listLoading}
                  onCellClick={(employee, dayIso) => {
                    setAssignEmployee(employee);
                    setAssignDate(dayIso);
                    setAssignError(null);
                    setAssignOpen(true);
                  }}
                  onRemoveAssignment={(a) => setPendingRemove(a)}
                />
              ) : view === "list" ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                      <tr>
                        <th className="px-4 py-3">Ngày</th>
                        <th className="px-4 py-3">Nhân viên</th>
                        <th className="px-4 py-3">Ca</th>
                        <th className="px-4 py-3">Chi nhánh</th>
                        <th className="px-4 py-3">Giờ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-12 text-center text-slate-400"
                          >
                            Chưa có phân ca trong khoảng này.
                          </td>
                        </tr>
                      ) : (
                        assignments.map((a) => (
                          <tr
                            key={a.id}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="px-4 py-3 text-slate-700">
                              {a.date}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {a.employee?.full_name ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {a.shift?.name ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {a.branch?.name ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {a.shift
                                ? `${a.shift.start_time} - ${a.shift.end_time}`
                                : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
                  <p className="text-sm font-medium text-slate-700">
                    Xem tháng đang được hoàn thiện
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Hiện dùng tab Tuần hoặc Danh sách để quản lý phân ca.
                  </p>
                </div>
              )}
            </div>

            <ScheduleSidePanel
              overview={overview}
              onQuickAction={(action) => {
                if (action === "print") {
                  window.print();
                  return;
                }
                showToast("Tính năng sẽ sớm có sẵn");
              }}
            />
          </div>
        </main>
      </div>

      <AssignShiftModal
        key={`${assignEmployee?.id ?? "x"}-${assignDate ?? "d"}`}
        open={assignOpen}
        employee={assignEmployee}
        date={assignDate}
        branches={branches}
        shifts={shifts}
        defaultBranchId={
          branchId ||
          assignEmployee?.branches.find((b) => b.is_primary)?.id ||
          assignEmployee?.branches[0]?.id ||
          branches[0]?.id ||
          ""
        }
        saving={assignSaving}
        error={assignError}
        onClose={() => {
          setAssignOpen(false);
          setAssignEmployee(null);
          setAssignDate(null);
        }}
        onSubmit={(payload) => {
          void handleAssign(payload);
        }}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Gỡ ca khỏi lịch"
        message={
          pendingRemove
            ? `Gỡ ca này khỏi ngày ${pendingRemove.date}?`
            : ""
        }
        confirmLabel="Gỡ ca"
        loading={removing}
        onClose={() => {
          if (!removing) setPendingRemove(null);
        }}
        onConfirm={() => void handleRemove()}
      />

      {toast ? (
        <div className="fixed right-5 bottom-5 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
