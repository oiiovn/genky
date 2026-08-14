"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import type { AttendanceRow } from "@/lib/attendance-api";

export function AttendanceRowActions({
  row,
  onView,
  onEdit,
  onDelete,
}: {
  row: AttendanceRow;
  onView: (row: AttendanceRow) => void;
  onEdit?: (row: AttendanceRow) => void;
  onDelete?: (row: AttendanceRow) => void;
}) {
  const hasRecord = Boolean(row.id);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={!hasRecord}
        onClick={() => onView(row)}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Xem"
        title={hasRecord ? "Xem" : "Chưa có bản ghi"}
      >
        <Eye className="h-4 w-4" />
      </button>
      {onEdit ? (
        <button
          type="button"
          disabled={!hasRecord}
          onClick={() => onEdit(row)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Sửa"
          title={hasRecord ? "Sửa" : "Chưa có bản ghi"}
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={() => onDelete(row)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          aria-label="Xoá"
          title={hasRecord ? "Xoá bản ghi" : "Xoá dòng tự sinh"}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
