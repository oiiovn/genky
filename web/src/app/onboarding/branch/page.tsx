"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MapPin, Navigation } from "lucide-react";
import {
  getAccessToken,
  getOnboardingStatus,
  setupFirstBranch,
} from "@/lib/api";

export default function OnboardingBranchPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(100);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geoLabel, setGeoLabel] = useState("Chưa lấy vị trí");
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
        if (status.next_step === "organization") {
          router.replace("/onboarding");
          return;
        }
        if (status.next_step === "dashboard") {
          router.replace("/dashboard");
          return;
        }
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

  function grabLocation() {
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ GPS.");
      return;
    }
    setGeoLabel("Đang lấy vị trí...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGeoLabel(
          `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        );
        setError(null);
      },
      () => {
        setGeoLabel("Không lấy được vị trí");
        setError("Không thể lấy GPS. Bạn vẫn có thể hoàn tất và cập nhật sau.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await setupFirstBranch({
        name,
        address,
        latitude,
        longitude,
        check_in_radius_meters: radius,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo chi nhánh.");
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
            Tạo chi nhánh đầu tiên
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Thiết lập vị trí để nhân viên check-in đúng chỗ
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tên chi nhánh
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lê Đức Thọ"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
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
                  placeholder="Nhập địa chỉ chi nhánh"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-10 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Vị trí GPS
              </label>
              <button
                type="button"
                onClick={grabLocation}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 hover:bg-white"
              >
                <span className="inline-flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-indigo-500" />
                  Lấy vị trí hiện tại
                </span>
                <span className="text-xs text-slate-400">{geoLabel}</span>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Bán kính check-in (mét)
              </label>
              <input
                required
                type="number"
                min={20}
                max={5000}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "Đang hoàn tất..." : "Hoàn tất thiết lập"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
