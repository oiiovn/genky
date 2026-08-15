"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, MoreVertical } from "lucide-react";
import clsx from "clsx";
import type {
  ReviewBoostOverviewData,
  ReviewLatestItem,
  ReviewVerifyStatus,
} from "@/lib/review-boost-types";
import { formatReviewCount } from "@/lib/review-boost-demo";
import { ReviewBoostKpis } from "@/components/marketing/ReviewBoostKpis";
import { ReviewBoostFunnel } from "@/components/marketing/ReviewBoostFunnel";
import {
  ReviewChannelDonut,
  ReviewDailyChart,
  ReviewRedeemGauge,
} from "@/components/marketing/ReviewBoostCharts";

const channelLabel: Record<string, string> = {
  shopee: "Shopee",
  shopee_food: "ShopeeFood",
  shopeefood: "ShopeeFood",
  grab_food: "GrabFood",
  grabfood: "GrabFood",
};

const statusUi: Record<
  ReviewVerifyStatus,
  { label: string; className: string }
> = {
  verified: {
    label: "Đã xác minh",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  pending: {
    label: "Chờ xác minh",
    className: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  rejected: {
    label: "Từ chối",
    className: "bg-rose-50 text-rose-700 ring-rose-100",
  },
};

function LatestRow({ item }: { item: ReviewLatestItem }) {
  const st = statusUi[item.status];
  return (
    <li className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
        {item.thumb}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-amber-500">
            {"★".repeat(5)} {item.rating.toFixed(1)}
          </span>
          <span className="truncate text-xs text-slate-400">{item.id}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {item.at} · {channelLabel[item.channel] ?? item.channel} · {item.branch}
        </p>
      </div>
      <span
        className={clsx(
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
          st.className,
        )}
      >
        {st.label}
      </span>
    </li>
  );
}

function OverviewQrCard({
  path,
  qrValue,
}: {
  path: string;
  qrValue: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { default: QRCode } = await import("qrcode");
        const url = await QRCode.toDataURL(qrValue, {
          width: 200,
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
  }, [qrValue]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(qrValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "qr-nhan-qua.png";
    a.click();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800">QR nhận quà</h3>
      <p className="mt-1 text-xs text-slate-400">
        Quét QR để đánh giá 5★ và nhận quà
      </p>
      <div className="mt-4 flex justify-center">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="QR nhận quà" className="h-36 w-36" />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center text-xs text-slate-400">
              Đang tạo QR…
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-xs text-slate-600">{path}</p>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white"
          aria-label="Sao chép link"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={download}
        disabled={!dataUrl}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        <Download className="h-4 w-4" />
        Tải QR
      </button>
    </section>
  );
}

export function ReviewBoostOverview({
  data,
  qrValue,
}: {
  data: ReviewBoostOverviewData;
  qrValue: string;
}) {
  const campaign = data.campaign;

  return (
    <div className="space-y-5">
      <ReviewBoostKpis items={data.kpis} />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <ReviewBoostFunnel steps={data.funnel} />
        </div>
        <div className="xl:col-span-6">
          <ReviewDailyChart data={data.daily} />
        </div>
        <div className="space-y-5 xl:col-span-3">
          <ReviewChannelDonut channels={data.channels} />
          <ReviewRedeemGauge
            ratePct={data.redeemRatePct}
            numer={data.redeemNumer}
            denom={data.redeemDenom}
            deltaPct={data.redeemDeltaPct}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-4">
          <h3 className="text-base font-semibold text-slate-800">
            Top chi nhánh
          </h3>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-slate-400 uppercase">
                <th className="pb-2 font-semibold">Chi nhánh</th>
                <th className="pb-2 font-semibold">5★</th>
                <th className="pb-2 font-semibold">Đổi quà</th>
                <th className="pb-2 text-right font-semibold">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody>
              {data.topBranches.map((row) => (
                <tr
                  key={row.name}
                  className="border-t border-slate-100 text-slate-700"
                >
                  <td className="py-2.5 font-medium">{row.name}</td>
                  <td className="py-2.5">{formatReviewCount(row.reviews)}</td>
                  <td className="py-2.5">{formatReviewCount(row.redeemed)}</td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">
                    {row.ratePct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-5">
          <h3 className="text-base font-semibold text-slate-800">
            Đánh giá mới nhất
          </h3>
          <ul className="mt-1">
            {data.latest.map((item) => (
              <LatestRow key={item.id} item={item} />
            ))}
          </ul>
        </section>

        <div className="xl:col-span-3">
          <OverviewQrCard path={data.publicReviewPath} qrValue={qrValue} />
        </div>
      </div>

      {campaign ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">
              Chiến dịch đang chạy
            </h3>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"
              aria-label="Tuỳ chọn"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl">
              {campaign.thumb}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-800">{campaign.title}</p>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100 ring-inset">
                  Đang chạy
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {campaign.from} – {campaign.to}
              </p>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                <span>{campaign.branches} chi nhánh</span>
                <span>{campaign.channels} kênh</span>
                <span>{formatReviewCount(campaign.reviews)} đánh giá</span>
                <span>{formatReviewCount(campaign.codes)} mã</span>
                <span>{formatReviewCount(campaign.redeemed)} đổi quà</span>
                <span className="font-semibold text-blue-600">
                  {campaign.ratePct.toFixed(1)}%
                </span>
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
