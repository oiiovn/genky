"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import type { Branch } from "@/lib/api";
import {
  createFlashSale,
  updateFlashSale,
  uploadFlashSaleProductImage,
  type FlashSaleBanner,
  type FlashSaleCampaign,
  type FlashSalePayload,
} from "@/lib/marketing-api";
import { APP_TIMEZONE, nowHm, todayIso } from "@/lib/timezone";

const ORANGE = "#F78C2E";

const BANNERS: { id: FlashSaleBanner; label: string }[] = [
  { id: "88", label: "8.8" },
  { id: "99", label: "9.9" },
  { id: "mid", label: "Giữa tháng" },
  { id: "end", label: "Xả kho" },
];

const DEFAULT_SLOTS = [
  { start: "12:00", end: "14:00" },
  { start: "20:00", end: "22:00" },
  { start: "00:00", end: "02:00" },
  { start: "09:00", end: "11:00" },
];

type ProductDraft = {
  id?: number;
  name: string;
  price: string;
  original: string;
  slotStart: string;
  slotEnd: string;
  imageUrl: string | null;
  file: File | null;
  preview: string | null;
};

function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function localToApi(value: string): string {
  if (!value) return "";
  const [date, time] = value.split("T");
  if (!date || !time) return value;
  return `${date} ${time.length === 5 ? `${time}:00` : time}`;
}

function defaultStart(): string {
  return `${todayIso()}T${nowHm()}`;
}

function defaultEnd(): string {
  const [h, m] = nowHm().split(":").map(Number);
  const endH = Math.min(23, h + 2);
  return `${todayIso()}T${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function emptyProduct(i = 0): ProductDraft {
  const slot = DEFAULT_SLOTS[i % DEFAULT_SLOTS.length];
  return {
    name: "",
    price: "",
    original: "",
    slotStart: slot.start,
    slotEnd: slot.end,
    imageUrl: null,
    file: null,
    preview: null,
  };
}

export function FlashSaleFormModal({
  open,
  editing,
  branches,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: FlashSaleCampaign | null;
  branches: Branch[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [banner, setBanner] = useState<FlashSaleBanner>("88");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [quota, setQuota] = useState("");
  const [sold, setSold] = useState("");
  const [revenue, setRevenue] = useState("");
  const [products, setProducts] = useState<ProductDraft[]>([emptyProduct(0)]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setTitle(editing.title);
      setBranchId(editing.branch_id ?? "");
      setBanner(editing.banner);
      setStartsAt(isoToLocal(editing.starts_at));
      setEndsAt(isoToLocal(editing.ends_at));
      setQuota(editing.quota ? String(editing.quota) : "");
      setSold(editing.sold ? String(editing.sold) : "");
      setRevenue(editing.revenue ? String(editing.revenue) : "");
      setProducts(
        editing.products.length > 0
          ? editing.products.map((p, i) => {
              const fallback = DEFAULT_SLOTS[i % DEFAULT_SLOTS.length];
              return {
                id: p.id,
                name: p.name,
                price: p.price ? String(p.price) : "",
                original: p.original ? String(p.original) : "",
                slotStart: p.slot_start || fallback.start,
                slotEnd: p.slot_end || fallback.end,
                imageUrl: p.image_url,
                file: null,
                preview: null,
              };
            })
          : [emptyProduct(0)],
      );
      return;
    }
    setTitle("");
    setBranchId(branches[0]?.id ?? "");
    setBanner("88");
    setStartsAt(defaultStart());
    setEndsAt(defaultEnd());
    setQuota("");
    setSold("");
    setRevenue("");
    setProducts([emptyProduct(0)]);
  }, [open, editing, branches]);

  useEffect(() => {
    return () => {
      products.forEach((p) => {
        if (p.preview) URL.revokeObjectURL(p.preview);
      });
    };
    // only revoke on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  function setProduct(i: number, patch: Partial<ProductDraft>) {
    setProducts((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function onPickFile(i: number, file: File | null) {
    setProducts((rows) =>
      rows.map((r, idx) => {
        if (idx !== i) return r;
        if (r.preview) URL.revokeObjectURL(r.preview);
        return {
          ...r,
          file,
          preview: file ? URL.createObjectURL(file) : null,
        };
      }),
    );
  }

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Nhập tên chương trình.");
      return;
    }
    if (!startsAt || !endsAt) {
      setError("Chọn thời gian bắt đầu và kết thúc.");
      return;
    }
    const named = products.filter((p) => p.name.trim());
    if (named.length === 0) {
      setError("Thêm ít nhất một sản phẩm.");
      return;
    }
    for (const p of named) {
      if (!p.slotStart || !p.slotEnd) {
        setError(`Chọn khung giờ cho “${p.name.trim()}”.`);
        return;
      }
    }
    setLoading(true);
    const payload: FlashSalePayload = {
      title: title.trim(),
      branch_id: branchId === "" ? null : Number(branchId),
      banner,
      starts_at: localToApi(startsAt),
      ends_at: localToApi(endsAt),
      quota: quota ? Number(quota) : 0,
      sold_count: sold ? Number(sold) : 0,
      revenue: revenue ? Number(revenue) : 0,
      products: named.map((p) => ({
        id: p.id,
        name: p.name.trim(),
        price: p.price ? Number(p.price) : 0,
        original_price: p.original ? Number(p.original) : 0,
        slot_start: p.slotStart,
        slot_end: p.slotEnd,
      })),
    };
    try {
      const res = editing
        ? await updateFlashSale(editing.id, payload)
        : await createFlashSale(payload);
      const saved = res.data.products;
      for (let i = 0; i < named.length; i += 1) {
        const file = named[i].file;
        const id = saved[i]?.id;
        if (file && id) {
          await uploadFlashSaleProductImage(res.data.id, id, file);
        }
      }
      onSaved(res.message);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-10">
      <div
        role="dialog"
        aria-modal="true"
        className="mb-10 w-full max-w-3xl rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">
            {editing ? "Chỉnh sửa chương trình" : "Tạo chương trình FlashSale"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Tên chương trình</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Flash Sale 8.8 – Siêu Rẻ Chớp Nhoáng"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Chi nhánh</span>
              <select
                value={branchId === "" ? "" : String(branchId)}
                onChange={(e) =>
                  setBranchId(e.target.value ? Number(e.target.value) : "")
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
              >
                <option value="">Tất cả chi nhánh</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Banner</span>
              <select
                value={banner}
                onChange={(e) => setBanner(e.target.value as FlashSaleBanner)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
              >
                {BANNERS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Ngày bắt đầu</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Ngày kết thúc</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Chỉ tiêu đơn</span>
              <input
                type="number"
                min={0}
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Đơn đã bán</span>
              <input
                type="number"
                min={0}
                value={sold}
                onChange={(e) => setSold(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Doanh thu (đ)</span>
              <input
                type="number"
                min={0}
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
              />
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                Sản phẩm & khung giờ
              </span>
              <button
                type="button"
                onClick={() =>
                  setProducts((rows) => [...rows, emptyProduct(rows.length)])
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm món
              </button>
            </div>
            <div className="space-y-3">
              {products.map((p, i) => {
                const src = p.preview || p.imageUrl;
                return (
                  <div
                    key={p.id ?? `new-${i}`}
                    className="rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => fileRefs.current[i]?.click()}
                        className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50"
                      >
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt={p.name || "Ảnh món"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex flex-col items-center gap-1 text-[11px] text-slate-400">
                            <ImagePlus className="h-5 w-5" />
                            Tải ảnh
                          </span>
                        )}
                      </button>
                      <input
                        ref={(el) => {
                          fileRefs.current[i] = el;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          onPickFile(i, e.target.files?.[0] ?? null)
                        }
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex gap-2">
                          <input
                            value={p.name}
                            onChange={(e) => setProduct(i, { name: e.target.value })}
                            placeholder="Tên sản phẩm"
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setProducts((rows) => {
                                const next = rows.filter((_, idx) => idx !== i);
                                return next.length ? next : [emptyProduct(0)];
                              })
                            }
                            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <label className="block">
                            <span className="text-[11px] text-slate-500">Bắt đầu</span>
                            <input
                              type="time"
                              value={p.slotStart}
                              onChange={(e) =>
                                setProduct(i, { slotStart: e.target.value })
                              }
                              className="mt-0.5 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] text-slate-500">Kết thúc</span>
                            <input
                              type="time"
                              value={p.slotEnd}
                              onChange={(e) =>
                                setProduct(i, { slotEnd: e.target.value })
                              }
                              className="mt-0.5 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] text-slate-500">Giá sale</span>
                            <input
                              type="number"
                              min={0}
                              value={p.price}
                              onChange={(e) =>
                                setProduct(i, { price: e.target.value })
                              }
                              className="mt-0.5 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] text-slate-500">Giá gốc</span>
                            <input
                              type="number"
                              min={0}
                              value={p.original}
                              onChange={(e) =>
                                setProduct(i, { original: e.target.value })
                              }
                              className="mt-0.5 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: ORANGE }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editing ? "Lưu thay đổi" : "Tạo chương trình"}
          </button>
        </div>
      </div>
    </div>
  );
}
