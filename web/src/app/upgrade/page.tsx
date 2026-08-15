"use client";

import { useEffect, useState } from "react";
import {
  Database,
  Headphones,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useAdminChrome } from "@/components/admin/AdminShell";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { PlanCard } from "@/components/billing/PlanCard";
import { UpgradeFaq } from "@/components/billing/UpgradeFaq";
import {
  fetchPlansCatalog,
  type PlansCatalog,
  type UpgradePlan,
} from "@/lib/plans-api";

export default function UpgradePage() {
  const { shell, headerData } = useAdminChrome(
    "Chọn gói phù hợp để mở khóa toàn bộ tính năng",
  );
  const [catalog, setCatalog] = useState<PlansCatalog | null>(null);
  const [yearly, setYearly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      try {
        setCatalog(await fetchPlansCatalog());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được gói.");
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function onAction(plan: UpgradePlan) {
    if (plan.contact_only) {
      showToast("Đội ngũ Genky sẽ liên hệ tư vấn sớm.");
      return;
    }
    if (plan.is_current) return;
    showToast(
      `Đã đăng ký dùng thử ${catalog?.trial_days ?? 14} ngày gói ${plan.name}.`,
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] text-slate-500">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      <Sidebar tenant={shell.tenant} active="Cài đặt" access={shell.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          data={headerData}
          subtitle="Chọn gói phù hợp để mở khóa toàn bộ tính năng"
        />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Nâng cấp gói</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Chọn gói phù hợp để mở khóa toàn bộ tính năng và nâng cao hiệu
                quả quản lý
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setYearly(false)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  !yearly
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                Thanh toán theo tháng
              </button>
              <button
                type="button"
                onClick={() => setYearly(true)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                  yearly
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                Thanh toán theo năm
                <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  Tiết kiệm đến 20%
                </span>
              </button>
            </div>
          </div>

          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-700">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Dùng thử miễn phí {catalog?.trial_days ?? 14} ngày cho tất cả các
              gói. Không cần thẻ thanh toán
              {catalog?.current_plan
                ? ` · Gói hiện tại: ${catalog.current_plan.name}`
                : null}
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(catalog?.plans ?? []).map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                yearly={yearly}
                onAction={onAction}
              />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                icon: ShieldCheck,
                title: "Thanh toán an toàn",
                desc: "Bảo mật SSL 256-bit",
              },
              {
                icon: XCircle,
                title: "Hủy bất cứ lúc nào",
                desc: "Không ràng buộc dài hạn",
              },
              {
                icon: Database,
                title: "Dữ liệu của bạn",
                desc: "Sao lưu & bảo mật 24/7",
              },
              {
                icon: Headphones,
                title: "Hỗ trợ tận tâm",
                desc: "Đội ngũ sẵn sàng hỗ trợ",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-800">
                    So sánh tính năng
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Xem chi tiết quyền lợi từng gói trước khi quyết định.
                  </p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                  <LayoutGrid className="h-5 w-5" />
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  showToast("Bảng so sánh chi tiết sẽ sớm có.")
                }
                className="mt-4 inline-flex rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                Xem bảng so sánh
              </button>
            </section>

            <UpgradeFaq />
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
