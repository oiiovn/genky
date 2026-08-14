"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { QrCodePanel } from "@/components/attendance/QrCodePanel";
import { QrSettingsPanel } from "@/components/attendance/QrSettingsPanel";
import { QrSideInfo } from "@/components/attendance/QrSideInfo";
import {
  fetchBranches,
  fetchDashboard,
  getAccessToken,
  me,
  type Branch,
} from "@/lib/api";
import {
  fetchQrCurrent,
  fetchQrRecent,
  fetchQrSettings,
  updateQrSettings,
  type QrHistoryRow,
  type QrSettings,
} from "@/lib/attendance-qr-api";
import type { DashboardData } from "@/types/dashboard";

export default function AttendanceQrPage() {
  const router = useRouter();
  const [shell, setShell] = useState<DashboardData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [settings, setSettings] = useState<QrSettings | null>(null);
  const [draft, setDraft] = useState<QrSettings | null>(null);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<QrHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const branchId = draft?.branch_id;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const loadQr = useCallback(
    async (id: number, enabled: boolean) => {
      if (!enabled) {
        setQrValue(null);
        setExpiresIn(0);
        return;
      }
      try {
        const current = await fetchQrCurrent(id);
        setQrValue(current.qr_value);
        setExpiresIn(current.expires_in);
        setUpdatedAt(current.updated_at);
      } catch (err) {
        setQrValue(null);
        setError(err instanceof Error ? err.message : "Không tải được QR.");
      }
    },
    [],
  );

  const loadRecent = useCallback(async (id: number) => {
    try {
      setHistory(await fetchQrRecent(id, 8));
    } catch {
      setHistory([]);
    }
  }, []);

  const loadForBranch = useCallback(
    async (id: number) => {
      setError(null);
      try {
        const next = await fetchQrSettings(id);
        setSettings(next);
        setDraft(next);
        await Promise.all([
          loadQr(next.branch_id, next.enabled),
          loadRecent(next.branch_id),
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không tải được cài đặt QR.",
        );
      }
    },
    [loadQr, loadRecent],
  );

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
        const [dashboard, branchList] = await Promise.all([
          fetchDashboard(),
          fetchBranches().catch(() => [] as Branch[]),
        ]);
        setShell(dashboard);
        setBranches(branchList);
        setLoading(false);

        const preferred =
          branchList.find((b) => b.is_headquarters)?.id ?? branchList[0]?.id;
        if (preferred) {
          await loadForBranch(preferred);
        }
      } catch {
        setLoading(false);
        router.replace("/login");
      }
    }
    void boot();
  }, [router, loadForBranch]);

  useEffect(() => {
    if (!branchId || !draft?.enabled) return;
    const timer = window.setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          void loadQr(branchId, true);
          void loadRecent(branchId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [branchId, draft?.enabled, loadQr, loadRecent]);

  useEffect(() => {
    if (!branchId) return;
    const poll = window.setInterval(() => {
      void loadRecent(branchId);
    }, 15000);
    return () => window.clearInterval(poll);
  }, [branchId, loadRecent]);

  const headerData = useMemo(() => {
    if (!shell) return null;
    return {
      ...shell,
      greeting: {
        ...shell.greeting,
        message: "Quét QR để chấm công Check-in / Check-out",
      },
    };
  }, [shell]);

  async function onToggleEnabled(next: boolean) {
    if (!draft) return;
    const updated = { ...draft, enabled: next };
    setDraft(updated);
    setSaving(true);
    try {
      const saved = await updateQrSettings({
        branch_id: updated.branch_id,
        enabled: next,
        rotate_seconds: updated.rotate_seconds,
        valid_from: updated.valid_from,
        valid_to: updated.valid_to,
        allow_check_in: updated.allow_check_in,
        allow_check_out: updated.allow_check_out,
      });
      setSettings(saved);
      setDraft(saved);
      await loadQr(saved.branch_id, saved.enabled);
      showToast(next ? "Đã bật QR chấm công" : "Đã tắt QR chấm công");
    } catch (err) {
      setDraft(settings);
      showToast(err instanceof Error ? err.message : "Không cập nhật được.");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveSettings() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await updateQrSettings({
        branch_id: draft.branch_id,
        enabled: draft.enabled,
        rotate_seconds: draft.rotate_seconds,
        valid_from: draft.valid_from,
        valid_to: draft.valid_to,
        allow_check_in: draft.allow_check_in,
        allow_check_out: draft.allow_check_out,
      });
      setSettings(saved);
      setDraft(saved);
      await Promise.all([
        loadQr(saved.branch_id, saved.enabled),
        loadRecent(saved.branch_id),
      ]);
      showToast("Đã cập nhật cài đặt QR");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  async function onBranchChange(next: QrSettings) {
    setDraft(next);
    if (next.branch_id !== settings?.branch_id) {
      await loadForBranch(next.branch_id);
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
      <Sidebar tenant={shell.tenant} active="QR chấm công" access={shell.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          data={headerData}
          subtitle="Quét QR để chấm công Check-in / Check-out"
        />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">QR chấm công</h2>
              <p className="text-sm text-slate-500">
                Quét QR để chấm công Check-in / Check-out
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Hiển thị QR chấm công
                </p>
                <p className="text-[11px] text-slate-400">
                  Tài khoản của bạn được cấp quyền xem và chấm công
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft?.enabled ?? false}
                disabled={!draft || saving}
                onClick={() => void onToggleEnabled(!(draft?.enabled ?? false))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  draft?.enabled ? "bg-indigo-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                    draft?.enabled ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              QR tự động đổi sau mỗi {draft?.rotate_seconds ?? 30} giây để đảm
              bảo an toàn và tránh việc chia sẻ cho người khác.
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          {branches.length === 0 ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
              Chưa có chi nhánh. Hãy thêm chi nhánh trước khi tạo QR chấm công.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <QrCodePanel
                value={qrValue}
                expiresIn={expiresIn}
                updatedAt={updatedAt}
                enabled={Boolean(draft?.enabled)}
                onRefresh={() => {
                  if (branchId && draft) {
                    void loadQr(branchId, draft.enabled);
                    void loadRecent(branchId);
                  }
                }}
              />

              {draft ? (
                <QrSettingsPanel
                  settings={draft}
                  branches={branches}
                  saving={saving}
                  onChange={(next) => void onBranchChange(next)}
                  onSave={() => void onSaveSettings()}
                />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-400 shadow-sm">
                  Đang tải cài đặt...
                </div>
              )}

              <QrSideInfo history={history} branchId={branchId} />
            </div>
          )}

          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-100 bg-[#FFF8EB] px-4 py-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Bảo mật & an toàn
              </p>
              <p className="mt-0.5 text-sm text-amber-800/80">
                QR được tự động đổi theo thời gian đã cài đặt và chỉ có hiệu lực
                tại vị trí được chọn.
              </p>
            </div>
          </div>
        </main>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <span className="rounded-full bg-slate-900/85 px-4 py-2 text-sm text-white">
            {toast}
          </span>
        </div>
      ) : null}
    </div>
  );
}
