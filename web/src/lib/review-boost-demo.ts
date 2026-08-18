import type {
  ReviewBoostOverviewData,
  ReviewChannel,
  ReviewGiftStatus,
  ReviewListRow,
  ReviewRedeemRow,
  ReviewRedeemStatus,
} from "@/lib/review-boost-types";

const NAMES = [
  "Nguyễn Văn An",
  "Trần Thị Bình",
  "Lê Minh Châu",
  "Phạm Quốc Dũng",
  "Hoàng Thu Hà",
  "Đỗ Văn Khoa",
  "Vũ Thanh Lan",
  "Bùi Đức Mạnh",
  "Ngô Thị Nga",
  "Đinh Hải Phong",
];

const PHONES = [
  "0988 123 456",
  "0903 222 111",
  "0912 555 888",
  "0977 444 333",
  "0938 666 777",
  "0966 111 222",
  "0944 333 999",
  "0922 888 000",
  "0899 121 343",
  "0888 454 676",
];

const CHANNELS: ReviewChannel[] = ["shopee", "shopee_food", "grab_food"];
const STATUSES: ReviewGiftStatus[] = [
  "gifted",
  "ungifted",
  "pending",
  "gifted",
  "ungifted",
  "gifted",
  "pending",
  "rejected",
  "gifted",
  "ungifted",
];

function buildListRows(branches: string[]): ReviewListRow[] {
  const b0 = branches[0] ?? "Chi nhánh chính";
  const b1 = branches[1] ?? "Chi nhánh 2";
  const b2 = branches[2] ?? "Chi nhánh 3";
  const branchCycle = [b0, b1, b0, b2, b1, b0, b2, b1, b0, b1];
  const codes = [
    "GEN-8K4P",
    null,
    null,
    "GEN-2M9Q",
    null,
    "GEN-7X1A",
    null,
    null,
    "GEN-4R2T",
    null,
  ];

  return NAMES.map((name, i) => ({
    id: `rv-${i + 1}`,
    orderCode: `#1308${6 - (i % 3)}-${788608850 + i}`,
    customerName: name,
    customerPhone: PHONES[i],
    channel: CHANNELS[i % CHANNELS.length],
    branch: branchCycle[i],
    reviewedAt: `13/08/2026 ${String(23 - i).padStart(2, "0")}:${String(15 + i * 3).padStart(2, "0")}`,
    rating: 5,
    giftStatus: STATUSES[i],
    giftCode:
      STATUSES[i] === "gifted" ? codes[i] ?? `GEN-${1000 + i}` : null,
  }));
}

function buildRedeemRows(branches: string[]): ReviewRedeemRow[] {
  const b0 = branches[0] ?? "Chi nhánh chính";
  const b1 = branches[1] ?? "Chi nhánh 2";
  const b2 = branches[2] ?? "Chi nhánh 3";
  const gifts = [
    { name: "Bánh tráng trộn", emoji: "🥗", price: 25000 },
    { name: "Trứng cút lắc", emoji: "🥚", price: 20000 },
    { name: "Nước ngọt", emoji: "🥤", price: 15000 },
    { name: "Nem nướng", emoji: "🍢", price: 30000 },
  ];
  const staff = ["Minh Anh", "Thu Hà", "Quốc Dũng", "Thanh Lan"];
  const statuses: ReviewRedeemStatus[] = [
    "success",
    "success",
    "processing",
    "success",
    "failed",
    "success",
    "success",
    "processing",
    "failed",
    "success",
  ];
  const notes = [
    null,
    null,
    "Đang chuẩn bị món",
    null,
    "Không đủ điều kiện",
    null,
    "Mã đã sử dụng",
    null,
    "Hết hạn mã",
    null,
  ];

  return NAMES.map((name, i) => {
    const gift = gifts[i % gifts.length];
    return {
      id: `rdm-${i + 1}`,
      giftCode: `GEN-${["8K4P", "2M9Q", "7X1A", "4R2T", "9B3C", "5H6J", "1N8M", "3P7L", "6D2W", "0Y5E"][i]}`,
      orderCode: `#1308${6 - (i % 3)}-${788608850 + i}`,
      customerName: name,
      customerPhone: PHONES[i],
      customerInitial: name.trim().split(/\s+/).pop()?.[0] ?? "K",
      channel: CHANNELS[i % CHANNELS.length],
      branch: [b0, b1, b0, b2, b1, b0, b2, b1, b0, b1][i],
      giftName: gift.name,
      giftEmoji: gift.emoji,
      giftPrice: gift.price,
      redeemedAt: `13/08/2026 ${String(20 - (i % 8)).padStart(2, "0")}:${String(10 + i * 4).padStart(2, "0")}`,
      staffName: staff[i % staff.length],
      staffInitial: staff[i % staff.length][0],
      status: statuses[i],
      note: notes[i],
    };
  });
}

/** Dữ liệu minh họa UI — thay bằng API khi backend sẵn sàng. */
export function buildReviewBoostDemoOverview(
  branchNames: string[],
): ReviewBoostOverviewData {
  const b0 = branchNames[0] ?? "Chi nhánh chính";
  const b1 = branchNames[1] ?? "Chi nhánh 2";
  const b2 = branchNames[2] ?? "Chi nhánh 3";
  const listRows = buildListRows([b0, b1, b2]);
  const redeemRows = buildRedeemRows([b0, b1, b2]);

  return {
    pendingCount: 12,
    publicReviewPath: "genky.vn/review/ldt-sp",
    listStats: {
      total: 1286,
      pending: 156,
      verified: 1042,
      gifted: 724,
      ungifted: 568,
      rejected: 32,
      totalDeltaPct: 18.5,
      pendingPct: 12.1,
      verifiedPct: 81.0,
      giftedPct: 56.3,
    },
    listRows,
    topCustomers: [
      {
        id: "c1",
        name: "Nguyễn Văn An",
        giftCount: 5,
        initial: "A",
        tone: "bg-blue-500",
      },
      {
        id: "c2",
        name: "Trần Thị Bình",
        giftCount: 4,
        initial: "B",
        tone: "bg-violet-500",
      },
      {
        id: "c3",
        name: "Lê Minh Châu",
        giftCount: 4,
        initial: "C",
        tone: "bg-emerald-500",
      },
      {
        id: "c4",
        name: "Phạm Quốc Dũng",
        giftCount: 3,
        initial: "D",
        tone: "bg-amber-500",
      },
      {
        id: "c5",
        name: "Hoàng Thu Hà",
        giftCount: 3,
        initial: "H",
        tone: "bg-rose-500",
      },
    ],
    redeemStats: {
      total: 724,
      success: 702,
      successPct: 96.9,
      processing: 8,
      processingPct: 1.1,
      failed: 14,
      failedPct: 1.9,
      totalValue: 18_100_000,
    },
    redeemRows,
    kpis: [
      {
        id: "reviews",
        label: "Đánh giá 5★",
        value: 1286,
        deltaPct: 18.5,
      },
      {
        id: "verified",
        label: "Đã xác minh",
        value: 1042,
        deltaPct: 15.8,
        sub: "Tỷ lệ xác minh: 81.0%",
      },
      {
        id: "codes",
        label: "Mã đã cấp",
        value: 936,
        deltaPct: 12.6,
        sub: "Tỷ lệ cấp mã: 89.8%",
      },
      {
        id: "redeemed",
        label: "Đã đổi quà",
        value: 724,
        deltaPct: 11.2,
        sub: "Tỷ lệ đổi quà: 77.4%",
      },
    ],
    funnel: [
      { id: "r5", label: "Đánh giá 5★", value: 1286, convertPct: 81 },
      { id: "ver", label: "Đã xác minh", value: 1042, convertPct: 90 },
      { id: "code", label: "Mã đã cấp", value: 936, convertPct: 77 },
      { id: "gift", label: "Đã đổi quà", value: 724 },
    ],
    daily: [
      { date: "2026-08-01", label: "01", count: 62, byChannel: { shopee: 30, shopee_food: 20, grab_food: 12 } },
      { date: "2026-08-02", label: "02", count: 71, byChannel: { shopee: 34, shopee_food: 22, grab_food: 15 } },
      { date: "2026-08-03", label: "03", count: 68, byChannel: { shopee: 32, shopee_food: 21, grab_food: 15 } },
      { date: "2026-08-04", label: "04", count: 84, byChannel: { shopee: 40, shopee_food: 26, grab_food: 18 } },
      { date: "2026-08-05", label: "05", count: 79, byChannel: { shopee: 38, shopee_food: 24, grab_food: 17 } },
      { date: "2026-08-06", label: "06", count: 91, byChannel: { shopee: 44, shopee_food: 28, grab_food: 19 } },
      { date: "2026-08-07", label: "07", count: 88, byChannel: { shopee: 42, shopee_food: 27, grab_food: 19 } },
      { date: "2026-08-08", label: "08", count: 102, byChannel: { shopee: 50, shopee_food: 32, grab_food: 20 } },
      { date: "2026-08-09", label: "09", count: 128, byChannel: { shopee: 62, shopee_food: 40, grab_food: 26 } },
      { date: "2026-08-10", label: "10", count: 110, byChannel: { shopee: 54, shopee_food: 34, grab_food: 22 } },
      { date: "2026-08-11", label: "11", count: 96, byChannel: { shopee: 46, shopee_food: 30, grab_food: 20 } },
      { date: "2026-08-12", label: "12", count: 104, byChannel: { shopee: 50, shopee_food: 32, grab_food: 22 } },
      { date: "2026-08-13", label: "13", count: 98, byChannel: { shopee: 48, shopee_food: 30, grab_food: 20 } },
    ],
    dailyChannels: [
      { id: "shopee", label: "Shopee" },
      { id: "shopee_food", label: "ShopeeFood" },
      { id: "grab_food", label: "GrabFood" },
    ],
    channels: [
      { id: "shopee", label: "Shopee", value: 744, color: "#FF6D00" },
      { id: "shopee_food", label: "ShopeeFood", value: 321, color: "#FF4E00" },
      { id: "grab_food", label: "GrabFood", value: 221, color: "#00B14F" },
    ],
    redeemRatePct: 77.4,
    redeemNumer: 724,
    redeemDenom: 936,
    redeemDeltaPct: 11.2,
    topBranches: [
      { name: b0, reviews: 612, redeemed: 348, ratePct: 78.2 },
      { name: b1, reviews: 401, redeemed: 226, ratePct: 74.1 },
      { name: b2, reviews: 273, redeemed: 150, ratePct: 71.5 },
    ],
    latest: [
      {
        id: "ORD-92841",
        rating: 5,
        at: "13/08 · 18:22",
        channel: "shopee",
        branch: b0,
        status: "verified",
        thumb: "🍜",
      },
      {
        id: "ORD-92812",
        rating: 5,
        at: "13/08 · 17:05",
        channel: "grab_food",
        branch: b1,
        status: "pending",
        thumb: "🧋",
      },
      {
        id: "ORD-92790",
        rating: 5,
        at: "13/08 · 15:40",
        channel: "shopee_food",
        branch: b0,
        status: "verified",
        thumb: "🥗",
      },
      {
        id: "ORD-92755",
        rating: 5,
        at: "13/08 · 14:11",
        channel: "shopee",
        branch: b2,
        status: "rejected",
        thumb: "🍲",
      },
      {
        id: "ORD-92720",
        rating: 5,
        at: "13/08 · 12:48",
        channel: "grab_food",
        branch: b0,
        status: "verified",
        thumb: "🍰",
      },
    ],
    campaign: {
      id: "cmp-1",
      title: "Đánh giá 5★ - Nhận bánh tráng",
      from: "01/08/2026",
      to: "31/08/2026",
      branches: Math.max(1, branchNames.length || 3),
      channels: 3,
      reviews: 1286,
      codes: 936,
      redeemed: 724,
      ratePct: 77.4,
      status: "running",
      thumb: "🎁",
    },
  };
}

export function formatReviewCount(n: number): string {
  return n.toLocaleString("vi-VN");
}
