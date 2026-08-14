"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, MapPin, Phone } from "lucide-react";
import {
  getAccessToken,
  getOnboardingStatus,
  setupOrganization,
} from "@/lib/api";

export default function OnboardingOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      if (!getAccessToken()) {
        router.replace("/login");
        return;
      }
      try {
        const status = await getOnboardingStatus();
        if (status.next_step === "branch") {
          router.replace("/onboarding/branch");
          return;
        }
        if (status.next_step === "dashboard") {
          router.replace("/dashboard");
          return;
        }
        setName(status.organization.name ?? "");
        setPhone(status.organization.phone ?? "");
        setAddress(status.organization.address ?? "");
      } catch {
        router.replace("/login");
        return;
      } finally {
        setBooting(false);
      }
    }
    void boot();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await setupOrganization({ name, phone, address });
      router.push("/onboarding/branch");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu.");
    } finally {
      setLoading(false);
    }
  }

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] text-slate-500">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f5ff]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "url('/images/auth-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "right center",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[55%] bg-gradient-to-r from-white/80 via-white/40 to-transparent lg:block"
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 lg:w-[46%] lg:justify-center">
        <div className="w-full max-w-[420px] rounded-[28px] border border-white/80 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.12)] sm:p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white">
              G
            </div>
            <span className="text-2xl font-extrabold text-slate-800">GENKY</span>
          </div>

          <h1 className="text-xl font-bold text-slate-800">
            Chào mừng đến với Genky 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Hãy thiết lập cửa hàng của bạn
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tên cửa hàng
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="FRESH - Bánh tráng trộn"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-10 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Số điện thoại
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Nhập số điện thoại"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-10 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Địa chỉ
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Nhập địa chỉ cửa hàng"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-10 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 disabled:opacity-60"
            >
              {loading ? "Đang lưu..." : "Tiếp tục"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
