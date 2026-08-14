"use client";

import {
  CheckCircle2,
  CloudDownload,
  FileSpreadsheet,
  Lightbulb,
  PencilLine,
  Printer,
} from "lucide-react";
import {
  formatHours,
  formatMoney,
  type TimesheetStats,
} from "@/lib/timesheet";

export function TimesheetSidePanel({
  stats,
  approvedCount,
  pendingCount,
  onAction,
}: {
  stats: TimesheetStats;
  approvedCount: number;
  pendingCount: number;
  onAction: (action: string) => void;
}) {
  const summary = [
    { label: "Nhân viên", value: String(stats.employees) },
    { label: "Ngày công TB", value: stats.avg_work_days.toFixed(1) },
    { label: "Tổng giờ làm", value: formatHours(stats.work_minutes) },
    { label: "Giờ OT", value: formatHours(stats.ot_minutes) },
    { label: "Đã duyệt", value: String(approvedCount) },
    { label: "Chờ duyệt", value: String(pendingCount) },
    { label: "Chi phí ước tính", value: formatMoney(stats.estimated_cost) },
  ];

  const actions = [
    { id: "approve", label: "Duyệt bảng công", icon: CheckCircle2 },
    { id: "adjust", label: "Điều chỉnh công", icon: PencilLine },
    { id: "import", label: "Nhập từ chấm công", icon: CloudDownload },
    { id: "export", label: "Xuất Excel", icon: FileSpreadsheet },
    { id: "print", label: "In bảng công", icon: Printer },
  ];

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[300px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Tóm tắt bảng công</h3>
        <ul className="mt-4 space-y-2.5">
          {summary.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-slate-500">{item.label}</span>
              <span className="font-semibold text-slate-800">{item.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Chức năng nhanh</h3>
        <div className="mt-3 space-y-1">
          {actions.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onAction(id)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">Mẹo sử dụng</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800/80">
              Duyệt bảng công trước khi chốt lương. Kiểm tra giờ OT và ngày nghỉ
              để tránh sai lệch chi phí nhân sự.
            </p>
          </div>
        </div>
      </section>
    </aside>
  );
}
