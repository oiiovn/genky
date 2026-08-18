export type ReviewChannel =
  | "shopee"
  | "shopee_food"
  | "grab_food"
  | "other"
  | string;

export type ReviewVerifyStatus = "verified" | "pending" | "rejected";

/** Trạng thái nghiệp vụ trên tab Đánh giá 5★ */
export type ReviewGiftStatus =
  | "pending"
  | "ungifted"
  | "gifted"
  | "rejected";

export type ReviewBoostKpi = {
  id: "reviews" | "verified" | "codes" | "redeemed";
  label: string;
  value: number;
  deltaPct: number;
  sub?: string;
};

export type ReviewFunnelStep = {
  id: string;
  label: string;
  value: number;
  convertPct?: number;
};

export type ReviewDailyPoint = {
  date: string;
  label: string;
  count: number;
  byChannel?: Record<string, number>;
};

export type ReviewDailyChannel = {
  id: string;
  label: string;
};

export type ReviewChannelSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type ReviewBranchRow = {
  name: string;
  reviews: number;
  redeemed: number;
  ratePct: number;
};

export type ReviewLatestItem = {
  id: string;
  rating: number;
  at: string;
  channel: string;
  branch: string;
  status: ReviewVerifyStatus;
  thumb: string;
};

export type ReviewListRow = {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  channel: ReviewChannel;
  channelLabel?: string;
  branch: string;
  reviewedAt: string;
  rating: number;
  giftStatus: ReviewGiftStatus;
  giftCode: string | null;
  reviewStatus?: string;
};

export type ReviewTopCustomer = {
  id: string;
  name: string;
  giftCount: number;
  initial: string;
  tone: string;
};

export type ReviewListStats = {
  total: number;
  pending: number;
  verified: number;
  gifted: number;
  ungifted: number;
  rejected: number;
  totalDeltaPct: number;
  pendingPct: number;
  verifiedPct: number;
  giftedPct: number;
};

export type ReviewRedeemStatus = "success" | "processing" | "failed";

export type ReviewRedeemRow = {
  id: string;
  giftCode: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerInitial: string;
  channel: ReviewChannel;
  branch: string;
  branchId?: number | null;
  giftName: string;
  giftEmoji: string;
  giftImageUrl?: string | null;
  giftPrice: number;
  redeemedAt: string;
  staffName: string;
  staffInitial: string;
  status: ReviewRedeemStatus;
  note: string | null;
};

export type ReviewRedeemStats = {
  total: number;
  success: number;
  successPct: number;
  processing: number;
  processingPct: number;
  failed: number;
  failedPct: number;
  totalValue: number;
};

export type ReviewCampaign = {
  id: string;
  title: string;
  from: string;
  to: string;
  branches: number;
  channels: number;
  reviews: number;
  codes: number;
  redeemed: number;
  ratePct: number;
  status: "running" | "paused" | "ended";
  thumb: string;
};

export type ReviewBoostOverviewData = {
  kpis: ReviewBoostKpi[];
  funnel: ReviewFunnelStep[];
  daily: ReviewDailyPoint[];
  dailyChannels?: ReviewDailyChannel[];
  channels: ReviewChannelSlice[];
  redeemRatePct: number;
  redeemNumer: number;
  redeemDenom: number;
  redeemDeltaPct: number;
  topBranches: ReviewBranchRow[];
  latest: ReviewLatestItem[];
  campaign: ReviewCampaign | null;
  publicReviewPath: string;
  pendingCount: number;
  listStats: ReviewListStats;
  listRows: ReviewListRow[];
  topCustomers: ReviewTopCustomer[];
  redeemStats: ReviewRedeemStats;
  redeemRows: ReviewRedeemRow[];
};
