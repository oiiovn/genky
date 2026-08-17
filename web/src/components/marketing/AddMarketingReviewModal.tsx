"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { Branch } from "@/lib/api";
import {
  createMarketingReview,
  fetchMarketingReviewFormMeta,
  type MarketingReviewFormMeta,
} from "@/lib/marketing-api";

type ParsedItem = {
  order_code: string;
  reviewed_at: string | null;
  rating: number | null;
};

function normalizeOrderCode(raw: string): string {
  const code = raw.trim();
  if (/^\d{4,}[-–]\d{6,}$/.test(code)) return `#${code}`;
  return code;
}

function normalizeReviewedAt(raw: string): string | null {
  const text = raw.trim();

  // dd/mm/yyyy HH:mm (ShopeeFood / VN)
  let m = text.match(
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/,
  );
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000) {
      let time = m[4] ?? "00:00:00";
      if (time.length === 5) time += ":00";
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${time}`;
    }
  }

  // yyyy-mm-dd HH:mm
  m = text.match(
    /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/,
  );
  if (!m) return null;
  const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  let time = m[4] ?? "00:00:00";
  if (time.length === 5) time += ":00";
  return `${date} ${time}`;
}

function parsePasteMany(text: string): ParsedItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const json = JSON.parse(trimmed) as unknown;
    if (Array.isArray(json)) {
      return uniqueByCode(
        json
          .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
          .map((row) => ({
            order_code: row.order_code
              ? normalizeOrderCode(String(row.order_code))
              : "",
            reviewed_at: row.reviewed_at
              ? normalizeReviewedAt(String(row.reviewed_at))
              : null,
            rating: row.rating != null ? Number(row.rating) : null,
          }))
          .filter((r) => r.order_code),
      );
    }
    if (json && typeof json === "object") {
      const obj = json as Record<string, unknown>;
      if (Array.isArray(obj.reviews)) {
        return parsePasteMany(JSON.stringify(obj.reviews));
      }
      if (obj.order_code) {
        return [
          {
            order_code: normalizeOrderCode(String(obj.order_code)),
            reviewed_at: obj.reviewed_at
              ? normalizeReviewedAt(String(obj.reviewed_at))
              : null,
            rating: obj.rating != null ? Number(obj.rating) : null,
          },
        ];
      }
    }
  } catch {
    /* not json */
  }

  const chunks = trimmed.split(/\n\s*\n+|^\s*[-–—]{3,}\s*$/m);
  const fromChunks: ParsedItem[] = [];
  for (const chunk of chunks) {
    const c = chunk.trim();
    if (!c) continue;
    const codes = [...c.matchAll(/#?\d{4,}[-–]\d{6,}/g)].map((m) =>
      normalizeOrderCode(m[0]),
    );
    if (codes.length !== 1) continue;
    fromChunks.push({
      order_code: codes[0],
      reviewed_at: normalizeReviewedAt(c),
      rating: (() => {
        const m = c.match(/([1-5])\s*[★*]/);
        return m ? Number(m[1]) : null;
      })(),
    });
  }
  if (fromChunks.length > 1) return uniqueByCode(fromChunks);

  const matches = [...trimmed.matchAll(/#?\d{4,}[-–]\d{6,}/g)];
  const list =
    matches.length > 0
      ? matches
      : [...trimmed.matchAll(/#\d[\d\-–]{5,}/g)];
  if (list.length === 0) return [];

  return uniqueByCode(
    list.map((m, i) => {
      const start = m.index ?? 0;
      const codeEnd = start + m[0].length;
      const end = list[i + 1]?.index ?? trimmed.length;
      const window = trimmed.slice(start, end);
      const afterCode = trimmed.slice(codeEnd, end);
      return {
        order_code: normalizeOrderCode(m[0]),
        reviewed_at:
          normalizeReviewedAt(afterCode) ?? normalizeReviewedAt(window),
        rating: (() => {
          const rm =
            window.match(/([1-5])\s*[★*]/) ??
            window.match(/(?<![0-9])([1-5])\.0(?![0-9])/);
          return rm ? Number(rm[1]) : null;
        })(),
      };
    }),
  );
}

function uniqueByCode(rows: ParsedItem[]): ParsedItem[] {
  const seen = new Set<string>();
  const out: ParsedItem[] = [];
  for (const row of rows) {
    const key = row.order_code.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function AddMarketingReviewModal({
  open,
  branches,
  preferredBranchId,
  onClose,
  onCreated,
}: {
  open: boolean;
  branches: Branch[];
  preferredBranchId?: number | "";
  onClose: () => void;
  onCreated: (summary: {
    created: number;
    updated: number;
    message: string;
  }) => void;
}) {
  const [meta, setMeta] = useState<MarketingReviewFormMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState<number | "">("");
  const [channelId, setChannelId] = useState<number | "">("");
  const [paste, setPaste] = useState("");

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    setLoadingMeta(true);
    setError(null);
    void fetchMarketingReviewFormMeta(ac.signal)
      .then((data) => {
        setMeta(data);
        const pref =
          preferredBranchId &&
          data.branches.some((b) => b.id === preferredBranchId)
            ? preferredBranchId
            : data.branches[0]?.id ?? "";
        setBranchId(typeof pref === "number" ? pref : "");
        setChannelId(data.channels[0]?.id ?? "");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Không tải form.");
      })
      .finally(() => setLoadingMeta(false));
    return () => ac.abort();
  }, [open, preferredBranchId]);

  const items = useMemo(() => parsePasteMany(paste), [paste]);

  if (!open) return null;

  const branchOptions = meta?.branches?.length
    ? meta.branches
    : branches.map((b) => ({
        id: b.id,
        name: b.name,
      }));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      if (!branchId || !channelId) {
        throw new Error("Chọn chi nhánh và kênh.");
      }
      if (items.length === 0) {
        throw new Error("Dán nội dung có ít nhất 1 mã đơn.");
      }
      const result = await createMarketingReview({
        branch_id: Number(branchId),
        channel_id: Number(channelId),
        campaign_id: meta?.campaign?.id,
        paste: paste.trim(),
        rating: 5,
        source: "manual_paste",
      });
      setPaste("");
      onCreated({
        created: result.meta?.created_count ?? 0,
        updated: result.meta?.updated_count ?? 0,
        message: result.message,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không lưu được đánh giá.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Thêm đánh giá
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Dán nhiều mã đơn cùng lúc. Mặc định 5★ · PENDING.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loadingMeta ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải…
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {!meta?.campaign ? (
              <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Đang tạo chiến dịch mặc định. Thử đóng rồi mở lại nếu vẫn thấy dòng này.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Campaign:{" "}
                <span className="font-semibold text-slate-700">
                  {meta.campaign.name}
                </span>
              </p>
            )}

            <label className="block text-sm font-medium text-slate-700">
              Chi nhánh
              <select
                value={branchId === "" ? "" : String(branchId)}
                onChange={(e) =>
                  setBranchId(e.target.value ? Number(e.target.value) : "")
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Chọn chi nhánh</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Kênh
              <select
                value={channelId === "" ? "" : String(channelId)}
                onChange={(e) =>
                  setChannelId(e.target.value ? Number(e.target.value) : "")
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Chọn kênh</option>
                {(meta?.channels ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Dán nội dung (OCR / text — nhiều đánh giá)
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={7}
                placeholder={`Dán nhiều block, cách nhau dòng trống:\n#13086-788608854  2026-08-13 23:15\n\n#13087-111222333  2026-08-14 10:02\n\nhoặc JSON array [{order_code, reviewed_at}, ...]`}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs outline-none focus:border-blue-400"
              />
            </label>

            {items.length > 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">
                  Phát hiện {items.length} mã đơn
                </p>
                <ul className="mt-1.5 max-h-36 space-y-1 overflow-y-auto text-xs text-slate-600">
                  {items.map((it) => (
                    <li key={it.order_code} className="flex justify-between gap-2">
                      <span className="font-mono">{it.order_code}</span>
                      <span className="shrink-0 text-slate-400">
                        {it.reviewed_at ?? "—"} · {it.rating ?? 5}★
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : paste.trim() ? (
              <p className="text-xs text-amber-700">
                Chưa nhận diện được mã đơn (dạng #13086-788608854).
              </p>
            ) : null}

            <p className="text-xs text-slate-500">
              Rating mặc định: <strong>5★</strong> · Trạng thái:{" "}
              <strong>PENDING</strong>
            </p>

            {error ? (
              <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={saving || !meta?.campaign || items.length === 0}
                onClick={() => void submit()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Lưu {items.length > 1 ? `${items.length} đánh giá` : "đánh giá"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
