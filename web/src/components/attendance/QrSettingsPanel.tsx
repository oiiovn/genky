"use client";

import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
import type { Branch } from "@/lib/api";
import type { QrSettings } from "@/lib/attendance-qr-api";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400";

export function QrSettingsPanel({
  settings,
  branches,
  saving,
  onChange,
  onSave,
}: {
  settings: QrSettings;
  branches: Branch[];
  saving: boolean;
  onChange: (next: QrSettings) => void;
  onSave: () => void;
}) {
  const rotateOptions =
    settings.rotate_options?.length > 0
      ? settings.rotate_options
      : [5, 10, 15, 30, 45, 60, 120];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800">Cài đặt QR</h3>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Thời gian đổi QR
          </span>
          <select
            className={inputClass}
            value={settings.rotate_seconds}
            onChange={(e) =>
              onChange({
                ...settings,
                rotate_seconds: Number(e.target.value),
              })
            }
          >
            {rotateOptions.map((s) => (
              <option key={s} value={s}>
                {s} giây
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">
              Vị trí áp dụng
            </span>
            <Link
              href="/settings/branches"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm chi nhánh
            </Link>
          </div>
          <div className="relative">
            <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-indigo-500" />
            <select
              className={`${inputClass} pl-9`}
              value={settings.branch_id}
              onChange={(e) => {
                const id = Number(e.target.value);
                const branch = branches.find((b) => b.id === id);
                onChange({
                  ...settings,
                  branch_id: id,
                  branch: branch
                    ? {
                        id: branch.id,
                        name: branch.name,
                        address: branch.address,
                      }
                    : settings.branch,
                });
              }}
            >
              {branches.length === 0 ? (
                <option value="">Chưa có chi nhánh</option>
              ) : (
                branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Chi nhánh {b.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            QR này chỉ có hiệu lực tại vị trí đã chọn
          </p>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Khung giờ hiệu lực
          </span>
          <div className="flex items-center gap-2">
            <input
              type="time"
              className={inputClass}
              value={settings.valid_from}
              onChange={(e) =>
                onChange({ ...settings, valid_from: e.target.value })
              }
            />
            <span className="text-slate-400">→</span>
            <input
              type="time"
              className={inputClass}
              value={settings.valid_to}
              onChange={(e) =>
                onChange({ ...settings, valid_to: e.target.value })
              }
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Nhân viên chỉ có thể chấm công trong khung giờ này
          </p>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Cho phép chấm công
          </span>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settings.allow_check_in}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    allow_check_in: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Check-in (Vào ca)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settings.allow_check_out}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    allow_check_out: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Check-out (Ra ca)
            </label>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Áp dụng cho cả quét QR và nút trên app (khi đã bật)
          </p>
        </div>

        <button
          type="button"
          disabled={saving || !settings.branch_id}
          onClick={onSave}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Cập nhật cài đặt"}
        </button>
      </div>
    </section>
  );
}
