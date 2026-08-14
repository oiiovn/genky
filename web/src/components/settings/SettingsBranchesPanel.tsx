"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  Building2,
  Clock3,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Timer,
  Users,
  Wallet,
  Wifi,
  X,
} from "lucide-react";
import {
  createBranch,
  deleteBranch,
  updateBranch,
  type Branch,
} from "@/lib/api";
import type { Employee } from "@/lib/employees-api";
import type { Shift } from "@/lib/shifts-api";
import {
  loadBranchExtra,
  saveBranchExtra,
  type BranchExtra,
} from "@/lib/branch-extra";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function SettingsBranchesPanel({
  branches,
  employees,
  shifts,
  onChanged,
  onToast,
}: {
  branches: Branch[];
  employees: Employee[];
  shifts: Shift[];
  onChanged: (next: Branch[]) => void;
  onToast: (msg: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(
    branches[0]?.id ?? null,
  );
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 5;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.address ?? "").toLowerCase().includes(q),
    );
  }, [branches, search]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageSafe = Math.min(page, lastPage);
  const pageRows = filtered.slice((pageSafe - 1) * perPage, pageSafe * perPage);
  const selected =
    branches.find((b) => b.id === selectedId) ?? pageRows[0] ?? null;

  function countEmployees(branchId: number) {
    return employees.filter((e) => e.branches.some((b) => b.id === branchId))
      .length;
  }

  function countShifts(branchId: number) {
    return shifts.filter((s) => s.branch_id === branchId || s.branch_id == null)
      .length;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5 xl:flex-row">
      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-800">Danh sách chi nhánh</h3>
            <p className="text-sm text-slate-500">
              Quản lý địa điểm và cấu hình chấm công
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModal("create")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Thêm chi nhánh
          </button>
        </div>

        <div className="px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm chi nhánh..."
              className="w-full rounded-xl border border-slate-200 py-2 pr-10 pl-9 text-sm outline-none focus:border-indigo-400"
            />
            <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <ul className="flex-1 space-y-2 px-5 pb-3">
          {pageRows.length === 0 ? (
            <li className="py-10 text-center text-sm text-slate-400">
              Chưa có chi nhánh.
            </li>
          ) : (
            pageRows.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  className={clsx(
                    "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition",
                    selected?.id === b.id
                      ? "border-indigo-400 bg-indigo-50/40"
                      : "border-slate-200 hover:border-indigo-200",
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-slate-800">
                        {b.name}
                      </p>
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          b.is_active
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-sky-50 text-sky-600",
                        )}
                      >
                        {b.is_active ? "Hoạt động" : "Tạm dừng"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {b.address || "Chưa có địa chỉ"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {countEmployees(b.id)} NV · {countShifts(b.id)} ca
                    </p>
                  </div>
                  <MoreHorizontal className="h-4 w-4 text-slate-300" />
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
          <p>
            Hiển thị {pageRows.length} / {filtered.length} chi nhánh
          </p>
          <div className="flex gap-1">
            {Array.from({ length: lastPage }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={clsx(
                  "h-8 min-w-8 rounded-lg px-2 text-sm font-medium",
                  pageSafe === p
                    ? "bg-indigo-500 text-white"
                    : "hover:bg-slate-100",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      {selected ? (
        <BranchDetail
          branch={selected}
          employeeCount={countEmployees(selected.id)}
          shiftCount={countShifts(selected.id)}
          onEdit={() => setModal("edit")}
          onToggle={async () => {
            const updated = await updateBranch(selected.id, {
              is_active: !selected.is_active,
            });
            onChanged(
              branches.map((b) => (b.id === updated.id ? updated : b)),
            );
            onToast(updated.is_active ? "Đã kích hoạt" : "Đã tạm dừng");
          }}
          onDelete={async () => {
            await deleteBranch(selected.id);
            const next = branches.filter((b) => b.id !== selected.id);
            onChanged(next);
            setSelectedId(next[0]?.id ?? null);
            onToast("Đã xoá chi nhánh");
          }}
          onToast={onToast}
        />
      ) : (
        <div className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-400 xl:w-[360px]">
          Chọn một chi nhánh để xem chi tiết
        </div>
      )}

      {modal ? (
        <BranchFormModal
          editing={modal === "edit" ? selected : null}
          onClose={() => setModal(null)}
          onSaved={(branch) => {
            if (modal === "edit") {
              onChanged(branches.map((b) => (b.id === branch.id ? branch : b)));
              onToast("Đã cập nhật chi nhánh");
            } else {
              onChanged([branch, ...branches]);
              setSelectedId(branch.id);
              onToast("Đã thêm chi nhánh");
            }
            setModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

function BranchDetail({
  branch,
  employeeCount,
  shiftCount,
  onEdit,
  onToggle,
  onDelete,
  onToast,
}: {
  branch: Branch;
  employeeCount: number;
  shiftCount: number;
  onEdit: () => void;
  onToggle: () => Promise<void>;
  onDelete: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const extra = loadBranchExtra(branch.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mapSrc =
    branch.latitude != null && branch.longitude != null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${branch.longitude - 0.01}%2C${branch.latitude - 0.01}%2C${branch.longitude + 0.01}%2C${branch.latitude + 0.01}&layer=mapnik&marker=${branch.latitude}%2C${branch.longitude}`
      : null;

  const rows = [
    { icon: Building2, label: "Mã chi nhánh", value: `CN${String(branch.id).padStart(3, "0")}` },
    { icon: MapPin, label: "Địa chỉ", value: branch.address || "—" },
    { icon: Phone, label: "Điện thoại", value: branch.phone || "—" },
    { icon: Clock3, label: "Giờ hoạt động", value: extra.hours },
    { icon: Users, label: "Quản lý", value: extra.manager_name || "—" },
  ];

  const stats = [
    { label: "Nhân viên", value: String(employeeCount), icon: Users },
    { label: "Ca làm việc", value: String(shiftCount), icon: Clock3 },
    { label: "Giờ công tháng", value: "—", icon: Timer },
    { label: "Quỹ lương tháng", value: "—", icon: Wallet },
  ];

  const config = [
    { label: "Phương thức chấm công", value: "GPS + App" },
    { label: "Bán kính check-in", value: `${branch.check_in_radius_meters} m` },
    { label: "WiFi", value: extra.wifi || "—" },
    {
      label: "Chấm công ngoài điểm",
      value: extra.allow_offsite ? "Cho phép" : "Không cho phép",
    },
    { label: "Ghi chú", value: extra.notes || "—" },
  ];

  return (
    <aside className="w-full shrink-0 space-y-4 xl:w-[360px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Thông tin chi nhánh</h3>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600"
          >
            <Pencil className="h-3.5 w-3.5" />
            Chỉnh sửa
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <p className="font-bold text-slate-800">{branch.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={clsx(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  branch.is_active
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-sky-50 text-sky-600",
                )}
              >
                {branch.is_active ? "Hoạt động" : "Tạm dừng"}
              </span>
              {branch.is_headquarters ? (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-600">
                  Chi nhánh trung tâm
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <ul className="mt-4 space-y-2.5">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.label} className="flex items-start gap-2.5 text-sm">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>
                  <span className="block text-xs text-slate-400">{r.label}</span>
                  <span className="font-medium text-slate-800">{r.value}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
              >
                <Icon className="h-4 w-4 text-indigo-500" />
                <p className="mt-1 text-lg font-bold text-slate-800">{s.value}</p>
                <p className="text-[11px] text-slate-500">{s.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-3">
          <h3 className="font-semibold text-slate-800">Bản đồ</h3>
          {mapSrc ? (
            <a
              href={`https://www.openstreetmap.org/?mlat=${branch.latitude}&mlon=${branch.longitude}#map=16/${branch.latitude}/${branch.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-indigo-600"
            >
              Xem bản đồ lớn
            </a>
          ) : null}
        </div>
        {mapSrc ? (
          <iframe
            title="Bản đồ chi nhánh"
            src={mapSrc}
            className="h-40 w-full border-t border-slate-100"
          />
        ) : (
          <p className="px-5 pb-4 text-sm text-slate-400">
            Chưa có toạ độ GPS. Chỉnh sửa chi nhánh để thêm vị trí.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Thiết lập chi nhánh</h3>
        <ul className="mt-3 space-y-2">
          {config.map((c) => (
            <li
              key={c.label}
              className="flex items-start justify-between gap-2 border-b border-slate-50 py-2 last:border-0"
            >
              <span>
                <span className="block text-xs text-slate-400">{c.label}</span>
                <span className="text-sm font-medium text-slate-800">
                  {c.value}
                </span>
              </span>
              <Pencil className="mt-1 h-3.5 w-3.5 text-slate-300" />
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void onToggle()}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600"
          >
            {branch.is_active ? "Tạm dừng" : "Kích hoạt"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600"
          >
            Xoá
          </button>
        </div>
      </section>
      <ConfirmDialog
        open={confirmDelete}
        title="Xóa chi nhánh"
        message={`Xóa chi nhánh “${branch.name}”? Hành động này không hoàn tác.`}
        loading={deleting}
        onClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        onConfirm={() => {
          setDeleting(true);
          void onDelete()
            .catch((e) => onToast(e.message))
            .finally(() => {
              setDeleting(false);
              setConfirmDelete(false);
            });
        }}
      />
    </aside>
  );
}

function BranchFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Branch | null;
  onClose: () => void;
  onSaved: (branch: Branch) => void;
}) {
  const extraInit = editing ? loadBranchExtra(editing.id) : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [radius, setRadius] = useState(
    String(editing?.check_in_radius_meters ?? 100),
  );
  const [lat, setLat] = useState(
    editing?.latitude != null ? String(editing.latitude) : "",
  );
  const [lng, setLng] = useState(
    editing?.longitude != null ? String(editing.longitude) : "",
  );
  const [hq, setHq] = useState(editing?.is_headquarters ?? false);
  const [extra, setExtra] = useState<BranchExtra>(
    extraInit ?? {
      email: "",
      hours: "08:00 - 22:00",
      manager_name: "",
      wifi: "",
      allow_offsite: false,
      notes: "",
    },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim() || null,
        check_in_radius_meters: Number(radius) || 100,
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
        is_headquarters: hq,
      };
      const branch = editing
        ? await updateBranch(editing.id, payload)
        : await createBranch(payload);
      saveBranchExtra(branch.id, extra);
      onSaved(branch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            {editing ? "Chỉnh sửa chi nhánh" : "Thêm chi nhánh"}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Tên chi nhánh *
            <input required value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Địa chỉ *
            <input required value={address} onChange={(e) => setAddress(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">
              Điện thoại
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input value={extra.email} onChange={(e) => setExtra({ ...extra, email: e.target.value })} className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">
              Vĩ độ
              <input value={lat} onChange={(e) => setLat(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Kinh độ
              <input value={lng} onChange={(e) => setLng(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">
              Bán kính (m)
              <input type="number" min={20} max={5000} value={radius} onChange={(e) => setRadius(e.target.value)} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Giờ hoạt động
              <input value={extra.hours} onChange={(e) => setExtra({ ...extra, hours: e.target.value })} className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            WiFi
            <span className="mt-1 flex items-center gap-2">
              <Wifi className="h-4 w-4 text-slate-400" />
              <input value={extra.wifi} onChange={(e) => setExtra({ ...extra, wifi: e.target.value })} className={inputClass} />
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={hq} onChange={(e) => setHq(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
            Chi nhánh trung tâm
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={extra.allow_offsite}
              onChange={(e) => setExtra({ ...extra, allow_offsite: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600"
            />
            Cho phép chấm công ngoài điểm
          </label>
          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}
