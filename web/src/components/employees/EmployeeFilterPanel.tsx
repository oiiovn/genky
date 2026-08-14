"use client";

import type { Branch } from "@/lib/api";
import type { Position } from "@/lib/employees-api";

export type FilterDraft = {
  branch_id: number | "";
  position_id: number | "";
  status: string;
  search: string;
};

export function EmployeeFilterPanel({
  draft,
  onChange,
  onApply,
  onReset,
  branches,
  positions,
}: {
  draft: FilterDraft;
  onChange: (next: FilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
  branches: Branch[];
  positions: Position[];
}) {
  return (
    <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:w-[260px]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Bộ lọc</h3>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          Xóa lọc
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Chi nhánh
          </label>
          <select
            value={draft.branch_id}
            onChange={(e) =>
              onChange({
                ...draft,
                branch_id: e.target.value ? Number(e.target.value) : "",
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          >
            <option value="">Tất cả</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Chức vụ
          </label>
          <select
            value={draft.position_id}
            onChange={(e) =>
              onChange({
                ...draft,
                position_id: e.target.value ? Number(e.target.value) : "",
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          >
            <option value="">Tất cả</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Trạng thái
          </label>
          <select
            value={draft.status}
            onChange={(e) => onChange({ ...draft, status: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          >
            <option value="">Tất cả</option>
            <option value="active">Đang làm việc</option>
            <option value="inactive">Tạm nghỉ</option>
            <option value="resigned">Nghỉ việc</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Tìm kiếm
          </label>
          <input
            value={draft.search}
            onChange={(e) => onChange({ ...draft, search: e.target.value })}
            placeholder="Tên, mã, SĐT..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          />
        </div>

        <button
          type="button"
          onClick={onApply}
          className="mt-2 w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600"
        >
          Áp dụng
        </button>
      </div>
    </aside>
  );
}
