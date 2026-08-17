"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
  Type,
  Volume2,
  X,
} from "lucide-react";
import type { Branch } from "@/lib/api";
import {
  clearMarketingRewardImage,
  createMarketingChannel,
  createMarketingReward,
  deleteMarketingChannel,
  deleteMarketingReward,
  ensureMarketingBranchQrs,
  fetchMarketingBranchQrs,
  fetchMarketingChannels,
  fetchMarketingLandingAudio,
  fetchMarketingRewardCodeSettings,
  fetchMarketingRewards,
  updateMarketingRewardCodeSettings,
  reorderMarketingChannels,
  seedMarketingChannelDefaults,
  seedMarketingRewardDefaults,
  updateMarketingChannel,
  updateMarketingReward,
  uploadMarketingLandingAudio,
  clearMarketingLandingAudio,
  uploadMarketingRewardImage,
  type MarketingBranchQrDto,
  type MarketingChannelDto,
  type MarketingRewardDto,
} from "@/lib/marketing-api";
import {
  defaultReviewBoostSettings,
  loadReviewBoostSettings,
  previewGiftCode,
  saveReviewBoostSettings,
  writeReviewLandingPreviewDraft,
  type ReviewBoostFullSettings,
  type ReviewChannelSetting,
  type ReviewCodeFormatId,
  type ReviewExpireMode,
  type ReviewGiftItemSetting,
  type ReviewLandingCopy,
} from "@/lib/review-boost-settings";

function channelFromApi(row: MarketingChannelDto): ReviewChannelSetting {
  return {
    id: String(row.id),
    code: row.code,
    name: row.name,
    color: row.color || "#64748B",
    icon: row.icon || "",
    enabled: row.enabled,
    sort_order: row.sort_order,
  };
}

function giftFromApi(row: MarketingRewardDto): ReviewGiftItemSetting {
  return {
    id: String(row.id),
    name: row.name,
    imageUrl: row.image_url,
    value: row.value,
    displayValue: row.display_value > 0 ? row.display_value : row.value,
    enabled: row.enabled,
    sort_order: row.sort_order,
  };
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-6 w-11 rounded-full transition",
        checked ? "bg-blue-600" : "bg-slate-200",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {children}
    </p>
  );
}

function Card({
  n,
  title,
  subtitle,
  action,
  children,
  className,
}: {
  n: number;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
              {n}
            </span>
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StyleText({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const cls =
    "mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400";
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      {rows ? (
        <textarea
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
    </label>
  );
}

const LANDING_FONTS: { id: string; label: string }[] = [
  { id: '"Be Vietnam Pro", "Inter", sans-serif', label: "Be Vietnam Pro" },
  { id: "Nunito, sans-serif", label: "Nunito" },
  { id: "Inter, sans-serif", label: "Inter" },
  { id: "system-ui, sans-serif", label: "Hệ thống" },
];

function SettingsQrPreview({
  value,
  filename = "qr-review-verify.png",
}: {
  value: string;
  filename?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!value) {
        setDataUrl(null);
        return;
      }
      try {
        const { default: QRCode } = await import("qrcode");
        const url = await QRCode.toDataURL(value, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR nhập mã" className="h-40 w-40" />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center text-xs text-slate-400">
            {value ? "Đang tạo QR…" : "Chưa có QR"}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={download}
        disabled={!dataUrl}
        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        <Download className="h-4 w-4" />
        Tải QR · PNG
      </button>
    </div>
  );
}

export function ReviewBoostSettingsPanel({
  orgId,
  branches,
  onSaved,
}: {
  orgId: number | string;
  branches: Branch[];
  branchId?: number | "";
  onSaved?: (url: string) => void;
}) {
  const [settings, setSettings] = useState<ReviewBoostFullSettings>(
    defaultReviewBoostSettings,
  );
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [styleTab, setStyleTab] = useState<
    "colors" | "banner" | "content" | "button" | "font" | "other"
  >("colors");
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [channelBusy, setChannelBusy] = useState(false);
  const [editingGiftId, setEditingGiftId] = useState<string | null>(null);
  const [giftsLoading, setGiftsLoading] = useState(true);
  const [giftsError, setGiftsError] = useState<string | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const [addGiftOpen, setAddGiftOpen] = useState(false);
  const [addGiftName, setAddGiftName] = useState("");
  const [addGiftValue, setAddGiftValue] = useState("15000");
  const [addGiftDisplayValue, setAddGiftDisplayValue] = useState("15000");
  const [addGiftFile, setAddGiftFile] = useState<File | null>(null);
  const [addGiftPreview, setAddGiftPreview] = useState<string | null>(null);
  const [addGiftError, setAddGiftError] = useState<string | null>(null);
  const [branchQrs, setBranchQrs] = useState<MarketingBranchQrDto[]>([]);
  const [qrsLoading, setQrsLoading] = useState(true);
  const [qrsError, setQrsError] = useState<string | null>(null);
  const [selectedQrBranchId, setSelectedQrBranchId] = useState<number | null>(
    null,
  );
  const [copiedQrId, setCopiedQrId] = useState<number | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);

  useEffect(() => {
    setSettings(loadReviewBoostSettings(orgId));
    setHydrated(true);
  }, [orgId]);

  useEffect(() => {
    const ac = new AbortController();
    setChannelsLoading(true);
    setChannelsError(null);
    void (async () => {
      try {
        let rows = await fetchMarketingChannels(ac.signal);
        if (rows.length === 0) {
          rows = await seedMarketingChannelDefaults();
        }
        if (ac.signal.aborted) return;
        setSettings((prev) => ({
          ...prev,
          channels: rows.map(channelFromApi),
        }));
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        setChannelsError(
          e instanceof Error ? e.message : "Không tải được kênh bán hàng.",
        );
      } finally {
        if (!ac.signal.aborted) setChannelsLoading(false);
      }
    })();
    return () => ac.abort();
  }, [orgId]);

  useEffect(() => {
    const ac = new AbortController();
    setGiftsLoading(true);
    setGiftsError(null);
    void (async () => {
      try {
        let rows = await fetchMarketingRewards(ac.signal);
        if (rows.length === 0) {
          rows = await seedMarketingRewardDefaults();
        }
        if (ac.signal.aborted) return;
        setSettings((prev) => ({
          ...prev,
          gifts: rows.map(giftFromApi),
        }));
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        setGiftsError(
          e instanceof Error ? e.message : "Không tải được món tặng.",
        );
      } finally {
        if (!ac.signal.aborted) setGiftsLoading(false);
      }
    })();
    return () => ac.abort();
  }, [orgId]);

  useEffect(() => {
    const ac = new AbortController();
    setQrsLoading(true);
    setQrsError(null);
    void (async () => {
      try {
        let rows = await fetchMarketingBranchQrs(ac.signal);
        if (rows.length === 0) {
          rows = await ensureMarketingBranchQrs();
        } else if (branches.length > 0 && rows.length < branches.length) {
          rows = await ensureMarketingBranchQrs();
        }
        if (ac.signal.aborted) return;
        setBranchQrs(rows);
        setSelectedQrBranchId((prev) => {
          if (prev && rows.some((r) => r.branch_id === prev)) return prev;
          return rows[0]?.branch_id ?? null;
        });
        if (rows[0]?.public_url) {
          setSettings((s) =>
            s.qrUrl === rows[0].public_url
              ? s
              : { ...s, qrUrl: rows[0].public_url },
          );
        }
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        setQrsError(
          e instanceof Error ? e.message : "Không tải được QR chi nhánh.",
        );
      } finally {
        if (!ac.signal.aborted) setQrsLoading(false);
      }
    })();
    return () => ac.abort();
  }, [orgId, branches.length]);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const audio = await fetchMarketingLandingAudio(ac.signal);
        if (ac.signal.aborted) return;
        setSettings((prev) => ({
          ...prev,
          landing: {
            ...prev.landing,
            guideAudioUrl: audio.audio_url,
            guideAudioName: audio.file_name ?? "",
          },
        }));
      } catch {
        /* giữ bản local nếu API lỗi */
      }
    })();
    return () => ac.abort();
  }, [orgId]);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const cfg = await fetchMarketingRewardCodeSettings(ac.signal);
        if (ac.signal.aborted) return;
        const type = String(cfg.expiry_type || "DAYS").toUpperCase();
        setSettings((prev) => ({
          ...prev,
          codePrefix: cfg.prefix || prev.codePrefix,
          codeLength: cfg.length || prev.codeLength,
          useLetters: cfg.use_letters,
          useDigits: cfg.use_numbers,
          excludeAmbiguous:
            cfg.exclude_zero ||
            cfg.exclude_o ||
            cfg.exclude_i ||
            cfg.exclude_one,
          expireMode:
            type === "NEVER"
              ? "never"
              : type === "DATE" || type === "FIXED_DATE"
                ? "fixed_date"
                : "after_days",
          expireDays: cfg.expiry_days || prev.expireDays,
          expireFixedDate: cfg.expiry_date || prev.expireFixedDate,
          rewardBeforeReview: cfg.reward_before_review,
        }));
      } catch {
        /* giữ bản local */
      }
    })();
    return () => ac.abort();
  }, [orgId]);

  const codePreview = useMemo(() => previewGiftCode(settings), [settings]);
  const enabledChannels = settings.channels.filter((c) => c.enabled).length;
  const enabledGifts = settings.gifts.filter((g) => g.enabled).length;
  const sortedChannels = useMemo(
    () =>
      [...settings.channels].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
      ),
    [settings.channels],
  );
  const sortedGifts = useMemo(
    () =>
      [...settings.gifts].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
      ),
    [settings.gifts],
  );
  const selectedQr = useMemo(
    () =>
      branchQrs.find((q) => q.branch_id === selectedQrBranchId) ??
      branchQrs[0] ??
      null,
    [branchQrs, selectedQrBranchId],
  );
  const landingPreviewUrl = `/review?preview=1&org=${encodeURIComponent(String(orgId))}`;
  const landing = settings.landing;

  function patch(partial: Partial<ReviewBoostFullSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  function patchLanding(partial: Partial<ReviewLandingCopy>) {
    setSettings((prev) => ({
      ...prev,
      landing: { ...prev.landing, ...partial },
    }));
  }

  function setChannelsFromApi(rows: MarketingChannelDto[]) {
    setSettings((prev) => ({
      ...prev,
      channels: rows.map(channelFromApi),
    }));
  }

  function patchChannelLocal(
    id: string,
    partial: Partial<ReviewChannelSetting>,
  ) {
    setSettings((prev) => ({
      ...prev,
      channels: prev.channels.map((c) =>
        c.id === id ? { ...c, ...partial } : c,
      ),
    }));
  }

  async function reloadChannels() {
    const rows = await fetchMarketingChannels();
    setChannelsFromApi(rows);
  }

  async function addChannel() {
    const name = window.prompt("Tên kênh mới?", "Kênh mới")?.trim();
    if (!name) return;
    setChannelBusy(true);
    try {
      const nextOrder =
        Math.max(0, ...settings.channels.map((c) => c.sort_order), 0) + 1;
      const created = await createMarketingChannel({
        name,
        color: "#64748B",
        enabled: true,
        sort_order: nextOrder,
      });
      setSettings((prev) => ({
        ...prev,
        channels: [...prev.channels, channelFromApi(created)],
      }));
      setEditingChannelId(String(created.id));
      showToast("Đã thêm kênh.");
      await reloadChannels();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không thêm được kênh.");
    } finally {
      setChannelBusy(false);
    }
  }

  async function saveChannelEdit(id: string) {
    const ch = settings.channels.find((c) => c.id === id);
    if (!ch) return;
    if (!ch.name.trim()) {
      showToast("Tên kênh không được trống.");
      return;
    }
    setChannelBusy(true);
    try {
      const updated = await updateMarketingChannel(ch.id, {
        name: ch.name.trim(),
        color: ch.color,
        enabled: ch.enabled,
      });
      setSettings((prev) => ({
        ...prev,
        channels: prev.channels.map((c) =>
          c.id === ch.id ? channelFromApi(updated) : c,
        ),
      }));
      setEditingChannelId(null);
      showToast("Đã lưu kênh.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không lưu được kênh.");
    } finally {
      setChannelBusy(false);
    }
  }

  async function toggleChannel(ch: ReviewChannelSetting, enabled: boolean) {
    patchChannelLocal(ch.id, { enabled });
    try {
      const updated = await updateMarketingChannel(ch.id, { enabled });
      setSettings((prev) => ({
        ...prev,
        channels: prev.channels.map((c) =>
          c.id === ch.id ? channelFromApi(updated) : c,
        ),
      }));
    } catch (e: unknown) {
      patchChannelLocal(ch.id, { enabled: ch.enabled });
      showToast(e instanceof Error ? e.message : "Không đổi trạng thái kênh.");
    }
  }

  async function moveChannel(id: string, direction: -1 | 1) {
    const ordered = sortedChannels;
    const index = ordered.findIndex((c) => c.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const swapped = [...ordered];
    const tmp = swapped[index];
    swapped[index] = swapped[target];
    swapped[target] = tmp;
    const next = swapped.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setSettings((prev) => ({ ...prev, channels: next }));
    try {
      const rows = await reorderMarketingChannels(next.map((c) => c.id));
      setChannelsFromApi(rows);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không sắp xếp được kênh.");
      // reload
      try {
        const rows = await fetchMarketingChannels();
        setChannelsFromApi(rows);
      } catch {
        /* ignore */
      }
    }
  }

  async function removeChannel(ch: ReviewChannelSetting) {
    if (!window.confirm(`Xoá kênh “${ch.name}”?`)) return;
    setChannelBusy(true);
    try {
      await deleteMarketingChannel(ch.id);
      setSettings((prev) => ({
        ...prev,
        channels: prev.channels.filter((c) => c.id !== ch.id),
      }));
      if (editingChannelId === ch.id) setEditingChannelId(null);
      showToast("Đã xoá kênh.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không xoá được kênh.");
    } finally {
      setChannelBusy(false);
    }
  }

  function setGiftsFromApi(rows: MarketingRewardDto[]) {
    setSettings((prev) => ({
      ...prev,
      gifts: rows.map(giftFromApi),
    }));
  }

  function patchGiftLocal(id: string, partial: Partial<ReviewGiftItemSetting>) {
    setSettings((prev) => ({
      ...prev,
      gifts: prev.gifts.map((g) => (g.id === id ? { ...g, ...partial } : g)),
    }));
  }

  function openAddGiftModal() {
    setAddGiftName("");
    setAddGiftValue("15000");
    setAddGiftDisplayValue("15000");
    setAddGiftFile(null);
    setAddGiftPreview(null);
    setAddGiftError(null);
    setAddGiftOpen(true);
  }

  function closeAddGiftModal() {
    if (giftBusy) return;
    setAddGiftOpen(false);
    setAddGiftPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAddGiftFile(null);
    setAddGiftError(null);
  }

  function forceCloseAddGiftModal() {
    setGiftBusy(false);
    setAddGiftOpen(false);
    setAddGiftPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAddGiftFile(null);
    setAddGiftError(null);
  }

  function onAddGiftFileChange(file: File | null) {
    setAddGiftPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setAddGiftFile(file);
  }

  async function submitAddGift() {
    const name = addGiftName.trim();
    if (!name) {
      setAddGiftError("Nhập tên món.");
      return;
    }
    const value = Math.max(
      0,
      Number(String(addGiftValue).replace(/[^\d]/g, "") || 0),
    );
    const displayValue = Math.max(
      0,
      Number(String(addGiftDisplayValue).replace(/[^\d]/g, "") || 0),
    );
    setGiftBusy(true);
    setAddGiftError(null);
    try {
      const nextOrder =
        Math.max(0, ...settings.gifts.map((g) => g.sort_order), 0) + 1;
      let created = await createMarketingReward({
        name,
        value,
        display_value: displayValue || value,
        enabled: true,
        sort_order: nextOrder,
      });
      if (addGiftFile) {
        created = await uploadMarketingRewardImage(created.id, addGiftFile);
      }
      setSettings((prev) => ({
        ...prev,
        gifts: [...prev.gifts, giftFromApi(created)],
      }));
      showToast("Đã thêm món.");
      forceCloseAddGiftModal();
      const rows = await fetchMarketingRewards();
      setGiftsFromApi(rows);
    } catch (e: unknown) {
      setAddGiftError(e instanceof Error ? e.message : "Không thêm được món.");
      setGiftBusy(false);
    }
  }

  async function saveGiftEdit(id: string) {
    const g = settings.gifts.find((item) => item.id === id);
    if (!g) return;
    if (!g.name.trim()) {
      showToast("Tên món không được trống.");
      return;
    }
    setGiftBusy(true);
    try {
      const updated = await updateMarketingReward(g.id, {
        name: g.name.trim(),
        value: Math.max(0, Math.floor(g.value)),
        display_value: Math.max(0, Math.floor(g.displayValue || g.value)),
        enabled: g.enabled,
      });
      patchGiftLocal(g.id, giftFromApi(updated));
      setEditingGiftId(null);
      showToast("Đã lưu món.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không lưu được món.");
    } finally {
      setGiftBusy(false);
    }
  }

  async function toggleGift(g: ReviewGiftItemSetting, enabled: boolean) {
    patchGiftLocal(g.id, { enabled });
    try {
      const updated = await updateMarketingReward(g.id, { enabled });
      patchGiftLocal(g.id, giftFromApi(updated));
    } catch (e: unknown) {
      patchGiftLocal(g.id, { enabled: g.enabled });
      showToast(e instanceof Error ? e.message : "Không đổi trạng thái món.");
    }
  }

  async function onGiftImageSelected(g: ReviewGiftItemSetting, file: File | null) {
    if (!file) return;
    setGiftBusy(true);
    try {
      const updated = await uploadMarketingRewardImage(g.id, file);
      patchGiftLocal(g.id, giftFromApi(updated));
      showToast("Đã tải ảnh món.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không tải được ảnh.");
    } finally {
      setGiftBusy(false);
    }
  }

  async function removeGiftImage(g: ReviewGiftItemSetting) {
    setGiftBusy(true);
    try {
      const updated = await clearMarketingRewardImage(g.id);
      patchGiftLocal(g.id, giftFromApi(updated));
      showToast("Đã xoá ảnh món.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không xoá được ảnh.");
    } finally {
      setGiftBusy(false);
    }
  }

  async function removeGift(g: ReviewGiftItemSetting) {
    if (!window.confirm(`Xoá món “${g.name}”?`)) return;
    setGiftBusy(true);
    try {
      await deleteMarketingReward(g.id);
      setSettings((prev) => ({
        ...prev,
        gifts: prev.gifts.filter((item) => item.id !== g.id),
      }));
      if (editingGiftId === g.id) setEditingGiftId(null);
      showToast("Đã xoá món.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không xoá được món.");
    } finally {
      setGiftBusy(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function onGuideAudioSelected(file: File | null) {
    if (!file) return;
    setAudioBusy(true);
    try {
      const audio = await uploadMarketingLandingAudio(file);
      patchLanding({
        guideAudioUrl: audio.audio_url,
        guideAudioName: audio.file_name ?? file.name,
      });
      showToast("Đã tải bản ghi hướng dẫn.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không tải được bản ghi.");
    } finally {
      setAudioBusy(false);
    }
  }

  async function removeGuideAudio() {
    setAudioBusy(true);
    try {
      await clearMarketingLandingAudio();
      patchLanding({ guideAudioUrl: null, guideAudioName: "" });
      showToast("Đã xoá bản ghi hướng dẫn.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không xoá được bản ghi.");
    } finally {
      setAudioBusy(false);
    }
  }

  async function save() {
    const url = selectedQr?.public_url || settings.qrUrl || settings.reviewUrl;
    saveReviewBoostSettings(orgId, {
      ...settings,
      qrUrl: url || settings.qrUrl,
    });
    try {
      await updateMarketingRewardCodeSettings({
        prefix: settings.codePrefix,
        length: settings.codeLength,
        use_letters: settings.useLetters,
        use_numbers: settings.useDigits,
        exclude_zero: settings.excludeAmbiguous,
        exclude_o: settings.excludeAmbiguous,
        exclude_i: settings.excludeAmbiguous,
        exclude_one: settings.excludeAmbiguous,
        expiry_type:
          settings.expireMode === "never"
            ? "NEVER"
            : settings.expireMode === "fixed_date"
              ? "DATE"
              : "DAYS",
        expiry_days: settings.expireDays,
        expiry_date: settings.expireFixedDate || null,
        reward_before_review: settings.rewardBeforeReview,
      });
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Không lưu được hạn mã.");
      return;
    }
    onSaved?.(url);
    showToast("Đã lưu cài đặt");
  }

  async function copyBranchQr(qr: MarketingBranchQrDto) {
    try {
      await navigator.clipboard.writeText(qr.public_url);
      setCopiedQrId(qr.id);
      window.setTimeout(() => setCopiedQrId(null), 1400);
    } catch {
      showToast("Không sao chép được");
    }
  }

  async function syncBranchQrs() {
    setQrsLoading(true);
    setQrsError(null);
    try {
      const rows = await ensureMarketingBranchQrs();
      setBranchQrs(rows);
      setSelectedQrBranchId((prev) => {
        if (prev && rows.some((r) => r.branch_id === prev)) return prev;
        return rows[0]?.branch_id ?? null;
      });
      showToast("Đã đồng bộ QR theo chi nhánh.");
    } catch (e: unknown) {
      setQrsError(
        e instanceof Error ? e.message : "Không đồng bộ được QR chi nhánh.",
      );
    } finally {
      setQrsLoading(false);
    }
  }

  const formatOptions: { id: ReviewCodeFormatId; label: string }[] = [
    { id: "gen4", label: "GEN-XXXX" },
    { id: "gen6", label: "GEN-XXXXXX" },
    { id: "xxxx", label: "XXXX-XXXX" },
    { id: "custom", label: "Tự tùy chỉnh" },
  ];

  const styleNav = [
    { id: "colors" as const, label: "Màu sắc", icon: Palette },
    { id: "banner" as const, label: "Banner", icon: ImageIcon },
    { id: "content" as const, label: "Nội dung", icon: Type },
    { id: "button" as const, label: "Nút bấm", icon: Settings2 },
    { id: "font" as const, label: "Font chữ", icon: Type },
    { id: "other" as const, label: "Khác", icon: Settings2 },
  ];

  if (!hydrated) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-2xl bg-slate-100"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative space-y-5 pb-20">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* 1 Channels */}
        <Card
          n={1}
          title="Kênh bán hàng"
          subtitle="Quản lý các kênh áp dụng chương trình"
          action={
            <button
              type="button"
              onClick={() => void addChannel()}
              disabled={channelBusy || channelsLoading}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm kênh
            </button>
          }
        >
          {channelsError ? (
            <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              Lỗi API kênh: {channelsError}
            </p>
          ) : channelsLoading ? (
            <p className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Đang tải kênh từ API…
            </p>
          ) : (
            <p className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Đã nối API · {sortedChannels.length} kênh · {enabledChannels} đang
              bật (ShopeeFood / GrabFood mặc định).
            </p>
          )}
          {channelsLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-slate-400 uppercase">
                <th className="pb-2 font-semibold"> </th>
                <th className="pb-2 font-semibold">Tên kênh</th>
                <th className="pb-2 font-semibold">Màu</th>
                <th className="pb-2 font-semibold">Trạng thái</th>
                <th className="pb-2 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {sortedChannels.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-sm text-slate-400"
                  >
                    Chưa có kênh. Nhấn “Thêm kênh” hoặc seed mặc định.
                  </td>
                </tr>
              ) : null}
              {sortedChannels.map((ch) => {
                const editing = editingChannelId === ch.id;
                return (
                  <tr key={ch.id} className="border-t border-slate-100 align-top">
                    <td className="py-2.5 pr-1">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          className="rounded p-0.5 text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                          aria-label="Đưa lên"
                          disabled={channelBusy}
                          onClick={() => void moveChannel(ch.id, -1)}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5">
                      {editing ? (
                        <input
                          value={ch.name}
                          onChange={(e) =>
                            patchChannelLocal(ch.id, { name: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          placeholder="Tên kênh"
                        />
                      ) : (
                        <div className="font-medium text-slate-800">
                          {ch.name}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5">
                      {editing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={ch.color}
                            onChange={(e) =>
                              patchChannelLocal(ch.id, { color: e.target.value })
                            }
                            className="h-8 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                            aria-label={`Màu ${ch.name}`}
                          />
                          <input
                            value={ch.color}
                            onChange={(e) =>
                              patchChannelLocal(ch.id, { color: e.target.value })
                            }
                            className="w-24 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs"
                          />
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ background: ch.color }}
                          />
                          {ch.color}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <Toggle
                        checked={ch.enabled}
                        label={`Bật ${ch.name}`}
                        onChange={(enabled) =>
                          void toggleChannel(ch, enabled)
                        }
                      />
                    </td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"
                          aria-label={editing ? "Lưu" : "Sửa"}
                          disabled={channelBusy}
                          onClick={() => {
                            if (editing) void saveChannelEdit(ch.id);
                            else setEditingChannelId(ch.id);
                          }}
                        >
                          {editing ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"
                          aria-label="Đưa xuống"
                          disabled={channelBusy}
                          onClick={() => void moveChannel(ch.id, 1)}
                        >
                          <GripVertical className="h-4 w-4 rotate-90" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                          aria-label="Xóa"
                          disabled={channelBusy}
                          onClick={() => void removeChannel(ch)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
          <Note>
            Chỉ các kênh đang bật mới được áp dụng trong chương trình. Mặc định
            có ShopeeFood và GrabFood — kênh khác tự thêm.
          </Note>
        </Card>

        {/* 2 Gifts */}
        <Card
          n={2}
          title="Món tặng"
          subtitle="Quản lý các món quà tặng cho khách hàng"
          action={
            <button
              type="button"
              onClick={openAddGiftModal}
              disabled={giftBusy || giftsLoading}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm món
            </button>
          }
        >
          {giftsError ? (
            <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              Lỗi API món: {giftsError}
            </p>
          ) : giftsLoading ? (
            <p className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Đang tải món từ API…
            </p>
          ) : (
            <p className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Đã nối API · {sortedGifts.length} món · {enabledGifts} đang bật.
            </p>
          )}
          {giftsLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-wide text-slate-400 uppercase">
                  <th className="pb-2 font-semibold">Tên món</th>
                  <th className="pb-2 font-semibold">Ảnh</th>
                  <th className="pb-2 font-semibold">Chi phí</th>
                  <th className="pb-2 font-semibold">Trị giá</th>
                  <th className="pb-2 font-semibold">TT</th>
                  <th className="pb-2 text-right font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {sortedGifts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-sm text-slate-400"
                    >
                      Chưa có món. Nhấn “Thêm món”.
                    </td>
                  </tr>
                ) : null}
                {sortedGifts.map((g) => {
                  const editing = editingGiftId === g.id;
                  return (
                    <tr key={g.id} className="border-t border-slate-100 align-top">
                      <td className="py-2.5">
                        {editing ? (
                          <input
                            value={g.name}
                            onChange={(e) =>
                              patchGiftLocal(g.id, { name: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                            placeholder="Tên món"
                          />
                        ) : (
                          <div className="font-medium text-slate-800">
                            {g.name}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          {g.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={g.imageUrl}
                              alt={g.name}
                              className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-lg ring-1 ring-slate-200">
                              🎁
                            </span>
                          )}
                          <div className="flex flex-col gap-1">
                            <label className="cursor-pointer text-[11px] font-semibold text-blue-600 hover:underline">
                              Tải ảnh
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                disabled={giftBusy}
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  e.target.value = "";
                                  void onGiftImageSelected(g, file);
                                }}
                              />
                            </label>
                            {g.imageUrl ? (
                              <button
                                type="button"
                                disabled={giftBusy}
                                onClick={() => void removeGiftImage(g)}
                                className="text-left text-[11px] text-slate-400 hover:text-rose-500"
                              >
                                Xoá ảnh
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5">
                        {editing ? (
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={g.value}
                            onChange={(e) =>
                              patchGiftLocal(g.id, {
                                value: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm tabular-nums"
                          />
                        ) : (
                          <span className="tabular-nums text-slate-700">
                            {formatVnd(g.value)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5">
                        {editing ? (
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={g.displayValue ?? g.value}
                            onChange={(e) =>
                              patchGiftLocal(g.id, {
                                displayValue: Math.max(
                                  0,
                                  Number(e.target.value) || 0,
                                ),
                              })
                            }
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm tabular-nums"
                          />
                        ) : (
                          <span className="tabular-nums text-slate-700">
                            {formatVnd(g.displayValue || g.value)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <Toggle
                          checked={g.enabled}
                          label={`Bật ${g.name}`}
                          onChange={(enabled) => void toggleGift(g, enabled)}
                        />
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"
                            aria-label={editing ? "Lưu" : "Sửa"}
                            disabled={giftBusy}
                            onClick={() => {
                              if (editing) void saveGiftEdit(g.id);
                              else setEditingGiftId(g.id);
                            }}
                          >
                            {editing ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Pencil className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                            aria-label="Xóa"
                            disabled={giftBusy}
                            onClick={() => void removeGift(g)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <Note>
            Món đang bật được gắn chiến dịch để nhân viên cấp mã khi xác minh
            đánh giá.
          </Note>
        </Card>

        {/* 3 Code format */}
        <Card
          n={3}
          title="Định dạng mã tặng"
          subtitle="Cấu hình định dạng mã tặng tự động"
        >
          <div className="grid grid-cols-2 gap-2">
            {formatOptions.map((opt) => (
              <label
                key={opt.id}
                className={clsx(
                  "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
                  settings.codeFormat === opt.id
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-600",
                )}
              >
                <input
                  type="radio"
                  name="codeFormat"
                  checked={settings.codeFormat === opt.id}
                  onChange={() => patch({ codeFormat: opt.id })}
                  className="accent-blue-600"
                />
                {opt.label}
              </label>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-4 py-3 text-center">
            <p className="font-mono text-lg font-bold tracking-wider text-blue-700">
              {codePreview}
            </p>
            <p className="mt-1 text-xs text-blue-600/80">10.000 mã khả dụng</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Tiền tố
              <input
                value={settings.codePrefix}
                onChange={(e) => patch({ codePrefix: e.target.value })}
                disabled={settings.codeFormat !== "custom"}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </label>
            <label className="text-sm text-slate-700">
              Độ dài
              <select
                value={settings.codeLength}
                onChange={(e) => patch({ codeLength: Number(e.target.value) })}
                disabled={settings.codeFormat !== "custom"}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              >
                <option value={4}>4 ký tự</option>
                <option value={6}>6 ký tự</option>
                <option value={8}>8 ký tự</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.useLetters}
                onChange={(e) => patch({ useLetters: e.target.checked })}
                className="accent-blue-600"
              />
              A–Z
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.useDigits}
                onChange={(e) => patch({ useDigits: e.target.checked })}
                className="accent-blue-600"
              />
              0–9
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.excludeAmbiguous}
                onChange={(e) => patch({ excludeAmbiguous: e.target.checked })}
                className="accent-blue-600"
              />
              Loại 0/O · 1/I
            </label>
          </div>
          <Note>Mã tặng không phân biệt chữ hoa chữ thường.</Note>
        </Card>

        {/* 4 Expire */}
        <Card
          n={4}
          title="Thời gian hết hạn mã tặng"
          subtitle="Thiết lập thời hạn sử dụng của mã tặng"
        >
          <div className="space-y-3">
            {(
              [
                {
                  id: "after_days" as ReviewExpireMode,
                  label: "Tính từ ngày cấp mã",
                },
                {
                  id: "fixed_date" as ReviewExpireMode,
                  label: "Hết hạn vào ngày cố định",
                },
                { id: "never" as ReviewExpireMode, label: "Không hết hạn" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id}
                className={clsx(
                  "flex flex-col gap-2 rounded-xl border px-3 py-3 text-sm",
                  settings.expireMode === opt.id
                    ? "border-blue-500 bg-blue-50/40"
                    : "border-slate-200",
                )}
              >
                <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                  <input
                    type="radio"
                    name="expireMode"
                    checked={settings.expireMode === opt.id}
                    onChange={() => patch({ expireMode: opt.id })}
                    className="accent-blue-600"
                  />
                  {opt.label}
                </span>
                {opt.id === "after_days" && settings.expireMode === "after_days" ? (
                  <span className="ml-6 inline-flex items-center gap-2 text-slate-600">
                    Hết hạn sau
                    <input
                      type="number"
                      min={1}
                      value={settings.expireDays}
                      onChange={(e) =>
                        patch({ expireDays: Number(e.target.value) || 1 })
                      }
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1"
                    />
                    ngày
                  </span>
                ) : null}
                {opt.id === "fixed_date" && settings.expireMode === "fixed_date" ? (
                  <input
                    type="date"
                    value={settings.expireFixedDate}
                    onChange={(e) => patch({ expireFixedDate: e.target.value })}
                    className="ml-6 rounded-lg border border-slate-200 px-2 py-1.5"
                  />
                ) : null}
              </label>
            ))}
          </div>
          <Note>
            Khách hàng cần đổi quà trước thời hạn để còn hiệu lực.
          </Note>
          <label
            className={clsx(
              "mt-3 flex flex-col gap-1 rounded-xl border px-3 py-3 text-sm",
              settings.rewardBeforeReview
                ? "border-blue-500 bg-blue-50/40"
                : "border-slate-200",
            )}
          >
            <span className="inline-flex items-center gap-2 font-medium text-slate-800">
              <input
                type="checkbox"
                checked={settings.rewardBeforeReview}
                onChange={(e) =>
                  patch({ rewardBeforeReview: e.target.checked })
                }
                className="accent-blue-600"
              />
              Thưởng trước đánh giá
            </span>
            <span className="ml-6 text-xs text-slate-500">
              Khách nhập đúng định dạng mã đơn vẫn được thưởng ngay. Sau 48 giờ
              hệ thống quét lại: có đánh giá thì giữ, chưa có thì huỷ.
            </span>
          </label>
        </Card>

        {/* 5 QR theo chi nhánh */}
        <Card
          n={5}
          title="QR theo chi nhánh"
          subtitle="Mỗi chi nhánh một QR → trang nhập mã đơn riêng"
          action={
            <button
              type="button"
              onClick={() => void syncBranchQrs()}
              disabled={qrsLoading}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Đồng bộ QR
            </button>
          }
        >
          {qrsError ? (
            <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {qrsError}
            </p>
          ) : (
            <p className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Khách quét QR chi nhánh A chỉ đổi quà cho đơn của chi nhánh A.
            </p>
          )}

          {qrsLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ) : branchQrs.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Chưa có QR. Bấm “Đồng bộ QR” (cần chiến dịch đang chạy).
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {branchQrs.map((qr) => (
                  <button
                    key={qr.id}
                    type="button"
                    onClick={() => {
                      setSelectedQrBranchId(qr.branch_id);
                      patch({ qrUrl: qr.public_url });
                    }}
                    className={clsx(
                      "rounded-xl border px-3 py-2 text-xs font-semibold",
                      selectedQr?.id === qr.id
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {qr.branch_name}
                  </button>
                ))}
              </div>

              {selectedQr ? (
                <>
                  <label className="block text-sm text-slate-700">
                    Link trang nhập mã · {selectedQr.branch_name}
                    <div className="mt-1 flex gap-2">
                      <input
                        readOnly
                        value={selectedQr.public_url}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => void copyBranchQr(selectedQr)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600"
                      >
                        {copiedQrId === selectedQr.id ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Sao chép
                      </button>
                    </div>
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingsQrPreview
                      value={selectedQr.public_url}
                      filename={`qr-${selectedQr.branch_id}.png`}
                    />
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                      <p className="font-semibold text-slate-800">Thông tin QR</p>
                      <ul className="mt-2 space-y-1.5">
                        <li>Chi nhánh: {selectedQr.branch_name}</li>
                        <li>Kiểu: Nhập mã đơn nhận quà</li>
                        <li className="break-all">Token: {selectedQr.token}</li>
                      </ul>
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            selectedQr.public_url,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Xem thử trang
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </Card>

        {/* 6 Style */}
        <Card
          n={6}
          title="Style trang tặng"
          subtitle="Tự soạn chữ và xem thử trang công khai cho khách"
          className="lg:col-span-3"
        >
          <div className="flex flex-col gap-4 lg:flex-row">
            <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-24 lg:flex-col">
              {styleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStyleTab(item.id)}
                    className={clsx(
                      "flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium",
                      styleTab === item.id
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-500 hover:bg-slate-50",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0 flex-1 space-y-3">
              {styleTab === "colors" ? (
                (
                  [
                    ["primary", "Màu chính"],
                    ["secondary", "Màu phụ"],
                    ["background", "Màu nền"],
                    ["text", "Màu chữ"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-2 text-sm text-slate-700"
                  >
                    {label}
                    <span className="inline-flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.style[key]}
                        onChange={(e) =>
                          patch({
                            style: {
                              ...settings.style,
                              [key]: e.target.value,
                            },
                          })
                        }
                        className="h-8 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                      />
                      <input
                        value={settings.style[key]}
                        onChange={(e) =>
                          patch({
                            style: {
                              ...settings.style,
                              [key]: e.target.value,
                            },
                          })
                        }
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs"
                      />
                    </span>
                  </label>
                ))
              ) : null}

              {styleTab === "banner" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <StyleText
                    label="Dòng cảm ơn"
                    value={landing.thankYou}
                    onChange={(thankYou) => patchLanding({ thankYou })}
                  />
                  <StyleText
                    label="Headline nổi bật"
                    value={landing.headlineAccent}
                    onChange={(headlineAccent) =>
                      patchLanding({ headlineAccent })
                    }
                  />
                  <StyleText
                    label="Headline phụ"
                    value={landing.headline}
                    onChange={(headline) => patchLanding({ headline })}
                  />
                  <StyleText
                    label="Nhãn nổi"
                    value={landing.badge}
                    onChange={(badge) => patchLanding({ badge })}
                  />
                  <div className="sm:col-span-2">
                    <StyleText
                      label="Thời hạn chương trình"
                      value={landing.expiry}
                      onChange={(expiry) => patchLanding({ expiry })}
                    />
                  </div>
                </div>
              ) : null}

              {styleTab === "content" ? (
                <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                  <StyleText
                    label="Tên cửa hàng"
                    value={landing.shopName}
                    onChange={(shopName) => patchLanding({ shopName })}
                  />
                  <StyleText
                    label="Slogan"
                    value={landing.tagline}
                    onChange={(tagline) => patchLanding({ tagline })}
                  />
                  <StyleText
                    label="Bước 1"
                    value={landing.step1}
                    onChange={(step1) => patchLanding({ step1 })}
                  />
                  <StyleText
                    label="Bước 2"
                    value={landing.step2}
                    onChange={(step2) => patchLanding({ step2 })}
                  />
                  <StyleText
                    label="Bước 3"
                    value={landing.step3}
                    onChange={(step3) => patchLanding({ step3 })}
                  />
                  <StyleText
                    label="Tiêu đề form"
                    value={landing.formTitle}
                    onChange={(formTitle) => patchLanding({ formTitle })}
                  />
                  <div className="sm:col-span-2">
                    <StyleText
                      label="Gợi ý form"
                      value={landing.formHint}
                      onChange={(formHint) => patchLanding({ formHint })}
                    />
                  </div>
                  <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Volume2 className="h-3.5 w-3.5" />
                      Bản ghi hướng dẫn nhận thưởng
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Khách nhấn để nghe trên trang tặng, phía trên ô nhập mã
                      đơn.
                    </p>
                    <StyleText
                      label="Chữ trên nút nghe"
                      value={landing.guideAudioLabel}
                      onChange={(guideAudioLabel) =>
                        patchLanding({ guideAudioLabel })
                      }
                    />
                    {landing.guideAudioUrl ? (
                      <div className="mt-2 space-y-2">
                        <p className="truncate text-xs text-slate-600">
                          {landing.guideAudioName || "Đã có bản ghi"}
                        </p>
                        <audio
                          controls
                          src={landing.guideAudioUrl}
                          className="w-full"
                        />
                        <button
                          type="button"
                          disabled={audioBusy}
                          onClick={() => void removeGuideAudio()}
                          className="text-xs text-rose-500 hover:underline"
                        >
                          Xoá bản ghi
                        </button>
                      </div>
                    ) : null}
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-blue-600">
                      {audioBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {landing.guideAudioUrl ? "Đổi bản ghi" : "Tải bản ghi lên"}
                      <input
                        type="file"
                        accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/aac,audio/ogg,audio/webm,.mp3,.m4a,.wav,.aac,.ogg,.webm"
                        className="hidden"
                        disabled={audioBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          void onGuideAudioSelected(file);
                        }}
                      />
                    </label>
                    <p className="mt-1 text-[11px] text-slate-400">
                      MP3, M4A, WAV · tối đa 15MB
                    </p>
                  </div>
                  <StyleText
                    label="Tiêu đề món tặng"
                    value={landing.giftsTitle}
                    onChange={(giftsTitle) => patchLanding({ giftsTitle })}
                  />
                  <div className="sm:col-span-2">
                    <StyleText
                      label="Lưu ý (mỗi dòng 1 ý)"
                      value={landing.notes}
                      rows={4}
                      onChange={(notes) => patchLanding({ notes })}
                    />
                  </div>
                  <StyleText
                    label="Footer"
                    value={landing.footerTitle}
                    onChange={(footerTitle) => patchLanding({ footerTitle })}
                  />
                  <StyleText
                    label="Footer phụ"
                    value={landing.footerText}
                    onChange={(footerText) => patchLanding({ footerText })}
                  />
                  <StyleText
                    label="Tiêu đề popup chúc mừng"
                    value={landing.winTitle}
                    onChange={(winTitle) => patchLanding({ winTitle })}
                  />
                  <div className="sm:col-span-2">
                    <StyleText
                      label="Lời chúc khi quay trúng"
                      value={landing.winMessage}
                      rows={2}
                      onChange={(winMessage) => patchLanding({ winMessage })}
                    />
                  </div>
                </div>
              ) : null}

              {styleTab === "button" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <StyleText
                    label="Nút thông tin cửa hàng"
                    value={landing.storeInfoLabel}
                    onChange={(storeInfoLabel) =>
                      patchLanding({ storeInfoLabel })
                    }
                  />
                  <StyleText
                    label="Nút quay thưởng"
                    value={landing.confirmLabel}
                    onChange={(confirmLabel) =>
                      patchLanding({ confirmLabel })
                    }
                  />
                  <StyleText
                    label="Placeholder mã đơn"
                    value={landing.orderPlaceholder}
                    onChange={(orderPlaceholder) =>
                      patchLanding({ orderPlaceholder })
                    }
                  />
                  <StyleText
                    label="Nút mua ngay"
                    value={landing.buyNowLabel}
                    onChange={(buyNowLabel) => patchLanding({ buyNowLabel })}
                  />
                  <div className="sm:col-span-2">
                    <StyleText
                      label="Link Shopee (nút Mua ngay)"
                      value={landing.buyNowUrl}
                      onChange={(buyNowUrl) => patchLanding({ buyNowUrl })}
                    />
                  </div>
                  <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                    Bo góc nút ({landing.buttonRadius}px)
                    <input
                      type="range"
                      min={8}
                      max={28}
                      value={landing.buttonRadius}
                      onChange={(e) =>
                        patchLanding({ buttonRadius: Number(e.target.value) })
                      }
                      className="mt-2 w-full"
                    />
                  </label>
                </div>
              ) : null}

              {styleTab === "font" ? (
                <label className="block text-sm font-medium text-slate-700">
                  Font chữ trang tặng
                  <select
                    value={landing.fontFamily}
                    onChange={(e) =>
                      patchLanding({ fontFamily: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  >
                    {LANDING_FONTS.map((font) => (
                      <option key={font.id} value={font.id}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {styleTab === "other" ? (
                <div className="grid gap-3">
                  <StyleText
                    label="Hướng dẫn mã đơn"
                    value={landing.orderHelp}
                    onChange={(orderHelp) => patchLanding({ orderHelp })}
                  />
                  <StyleText
                    label="Link hướng dẫn"
                    value={landing.orderGuide}
                    onChange={(orderGuide) => patchLanding({ orderGuide })}
                  />
                </div>
              ) : null}
            </div>

            <div className="mx-auto w-[200px] shrink-0 space-y-3">
              <div
                className="overflow-hidden rounded-[1.4rem] border-4 border-slate-800 shadow-lg"
                style={{
                  background: settings.style.background,
                  fontFamily: landing.fontFamily,
                }}
              >
                <div className="px-3 pt-3 pb-4 text-center">
                  <p
                    className="truncate text-[10px] font-bold"
                    style={{ color: settings.style.text }}
                  >
                    {landing.shopName}
                  </p>
                  <p
                    className="mt-2 text-[11px] leading-snug font-extrabold"
                    style={{ color: settings.style.primary }}
                  >
                    {landing.headlineAccent}
                    <br />
                    {landing.headline}
                  </p>
                  <div className="mx-auto mt-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                    🎁
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] text-slate-400">
                    {landing.orderPlaceholder}
                  </div>
                  <button
                    type="button"
                    className="mt-2 w-full py-1.5 text-[9px] font-bold text-white"
                    style={{
                      background: settings.style.primary,
                      borderRadius: landing.buttonRadius,
                    }}
                  >
                    {landing.confirmLabel === "Xác nhận"
                      ? "Quay Thưởng"
                      : landing.confirmLabel}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  try {
                    writeReviewLandingPreviewDraft(orgId, settings);
                  } catch {
                    /* ignore */
                  }
                  window.open(
                    landingPreviewUrl,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
              >
                Xem thử trang
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
        >
          <Save className="h-4 w-4" />
          Lưu cài đặt
        </button>
      </div>

      {addGiftOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeAddGiftModal}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Thêm món tặng
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Nhập tên, ảnh, chi phí và trị giá món.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddGiftModal}
                disabled={giftBusy}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Tên món
                <input
                  autoFocus
                  value={addGiftName}
                  onChange={(e) => setAddGiftName(e.target.value)}
                  placeholder="VD: Bánh tráng trộn"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </label>

              <div>
                <p className="text-sm font-medium text-slate-700">Ảnh món</p>
                <div className="mt-1.5 flex items-center gap-3">
                  {addGiftPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={addGiftPreview}
                      alt="Xem trước"
                      className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-50 text-2xl ring-1 ring-slate-200">
                      🎁
                    </span>
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="cursor-pointer text-sm font-semibold text-blue-600 hover:underline">
                      Chọn ảnh
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={giftBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          onAddGiftFileChange(file);
                        }}
                      />
                    </label>
                    {addGiftFile ? (
                      <button
                        type="button"
                        disabled={giftBusy}
                        onClick={() => onAddGiftFileChange(null)}
                        className="text-left text-xs text-slate-400 hover:text-rose-500"
                      >
                        Bỏ ảnh
                      </button>
                    ) : (
                      <p className="text-xs text-slate-400">
                        JPG, PNG, WEBP · tối đa 8MB
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Chi phí (VNĐ)
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={addGiftValue}
                  onChange={(e) => setAddGiftValue(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm tabular-nums outline-none focus:border-blue-400"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Trị giá (VNĐ)
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={addGiftDisplayValue}
                  onChange={(e) => setAddGiftDisplayValue(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm tabular-nums outline-none focus:border-blue-400"
                />
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  Số này hiện cho khách khi quay thưởng.
                </span>
              </label>

              {addGiftError ? (
                <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {addGiftError}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAddGiftModal}
                disabled={giftBusy}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => void submitAddGift()}
                disabled={giftBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {giftBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Thêm món
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed right-5 bottom-20 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
