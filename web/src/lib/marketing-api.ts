import { authFetch, getAccessToken } from "@/lib/api";
import { apiUrl } from "@/lib/api-base";
import type { ReviewBoostOverviewData } from "@/lib/review-boost-types";

function authHeaders(json = false): HeadersInit {
  const access = getAccessToken();
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
  };
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data.errors) {
      const first = Object.values(data.errors as Record<string, string[]>)[0];
      if (Array.isArray(first) && first[0]) return first[0];
    }
    if (data.message) return data.message;
  } catch {
    /* ignore */
  }
  return "Yêu cầu marketing thất bại.";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeDailyPoint(raw: unknown) {
  const row = asRecord(raw);
  const byRaw = asRecord(row.byChannel ?? row.by_channel);
  const byChannel: Record<string, number> = {};
  for (const [key, value] of Object.entries(byRaw)) {
    byChannel[key] = Number(value ?? 0);
  }
  return {
    date: String(row.date ?? ""),
    label: String(row.label ?? ""),
    count: Number(row.count ?? 0),
    byChannel,
  };
}

function normalizeDailyChannel(raw: unknown) {
  const row = asRecord(raw);
  return {
    id: String(row.id ?? ""),
    label: String(row.label ?? row.name ?? row.id ?? ""),
  };
}

function normalizeOverview(raw: ReviewBoostOverviewData): ReviewBoostOverviewData {
  const data = asRecord(raw) as unknown as ReviewBoostOverviewData;
  const dailyRaw = (data.daily ?? []) as unknown[];
  const channelsRaw = ((data as unknown as Record<string, unknown>).dailyChannels
    ?? (data as unknown as Record<string, unknown>).daily_channels
    ?? []) as unknown[];

  return {
    ...data,
    daily: dailyRaw.map(normalizeDailyPoint),
    dailyChannels: channelsRaw.map(normalizeDailyChannel).filter((c) => c.id),
  };
}

export type MarketingOverviewFilters = {
  branch_id?: number | "";
  from?: string;
  to?: string;
};

export async function fetchMarketingReviewOverview(
  filters: MarketingOverviewFilters = {},
  signal?: AbortSignal,
): Promise<ReviewBoostOverviewData> {
  const params = new URLSearchParams();
  if (filters.branch_id) params.set("branch_id", String(filters.branch_id));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  const qs = params.toString();
  const res = await fetch(
    `${apiUrl()}/marketing/reviews/overview${qs ? `?${qs}` : ""}`,
    {
      headers: authHeaders(),
      cache: "no-store",
      signal,
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: ReviewBoostOverviewData };
  return normalizeOverview(json.data);
}

export type MarketingReviewFormMeta = {
  campaign: {
    id: number;
    name: string;
    min_rating: number;
    start_at: string | null;
    end_at: string | null;
  } | null;
  channels: { id: number; name: string; code: string; color: string | null }[];
  branches: { id: number; name: string }[];
  rewards: {
    id: number;
    name: string;
    value: number;
    display_value: number;
    image_url: string | null;
  }[];
  defaults: { rating: number };
};

export async function fetchMarketingReviewFormMeta(
  signal?: AbortSignal,
): Promise<MarketingReviewFormMeta> {
  const res = await fetch(`${apiUrl()}/marketing/reviews/form-meta`, {
    headers: authHeaders(),
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: MarketingReviewFormMeta };
  return json.data;
}

export type CreateMarketingReviewPayload = {
  campaign_id?: number;
  branch_id: number;
  channel_id: number;
  paste?: string;
  order_code?: string;
  reviewed_at?: string;
  rating?: number;
  customer_name?: string;
  customer_phone?: string;
  source?: string;
};

export type CreateMarketingReviewResult = {
  data: Record<string, unknown>[];
  meta: {
    created_count: number;
    updated_count: number;
    failed_count: number;
    failed: { order_code: string | null; message: string }[];
  };
  message: string;
};

export async function createMarketingReview(
  payload: CreateMarketingReviewPayload,
): Promise<CreateMarketingReviewResult> {
  const res = await fetch(`${apiUrl()}/marketing/reviews`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CreateMarketingReviewResult;
}

export type MarketingReviewListData = {
  listStats: ReviewBoostOverviewData["listStats"];
  listRows: ReviewBoostOverviewData["listRows"];
  topCustomers: ReviewBoostOverviewData["topCustomers"];
  from?: string;
  to?: string;
};

function normalizeListRow(raw: Record<string, unknown>) {
  return {
    id: String(raw.id ?? raw.ID ?? ""),
    orderCode: String(raw.orderCode ?? raw.order_code ?? ""),
    customerName: String(raw.customerName ?? raw.customer_name ?? "—"),
    customerPhone: String(raw.customerPhone ?? raw.customer_phone ?? "—"),
    channel: String(raw.channel ?? "other"),
    channelLabel: (raw.channelLabel ?? raw.channel_label) as string | undefined,
    branch: String(raw.branch ?? "—"),
    reviewedAt: String(raw.reviewedAt ?? raw.reviewed_at ?? "—"),
    rating: Number(raw.rating ?? 5),
    giftStatus: (raw.giftStatus ?? raw.gift_status ?? "pending") as ReviewBoostOverviewData["listRows"][number]["giftStatus"],
    giftCode: (raw.giftCode ?? raw.gift_code ?? null) as string | null,
    reviewStatus: (raw.reviewStatus ?? raw.review_status) as string | undefined,
  };
}

export async function fetchMarketingReviewList(
  filters: MarketingOverviewFilters = {},
  signal?: AbortSignal,
): Promise<MarketingReviewListData> {
  const params = new URLSearchParams();
  if (filters.branch_id) params.set("branch_id", String(filters.branch_id));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  const qs = params.toString();
  const res = await fetch(
    `${apiUrl()}/marketing/reviews${qs ? `?${qs}` : ""}`,
    {
      headers: authHeaders(),
      cache: "no-store",
      signal,
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  const data = json.data ?? {};
  const rowsRaw = (data.listRows ?? data.list_rows ?? []) as Record<
    string,
    unknown
  >[];
  const statsRaw = (data.listStats ?? data.list_stats ?? {}) as Record<
    string,
    unknown
  >;

  return {
    listStats: {
      total: Number(statsRaw.total ?? 0),
      pending: Number(statsRaw.pending ?? 0),
      verified: Number(statsRaw.verified ?? 0),
      gifted: Number(statsRaw.gifted ?? 0),
      ungifted: Number(statsRaw.ungifted ?? 0),
      rejected: Number(statsRaw.rejected ?? 0),
      totalDeltaPct: Number(statsRaw.totalDeltaPct ?? statsRaw.total_delta_pct ?? 0),
      pendingPct: Number(statsRaw.pendingPct ?? statsRaw.pending_pct ?? 0),
      verifiedPct: Number(statsRaw.verifiedPct ?? statsRaw.verified_pct ?? 0),
      giftedPct: Number(statsRaw.giftedPct ?? statsRaw.gifted_pct ?? 0),
    },
    listRows: rowsRaw.map(normalizeListRow),
    topCustomers: (data.topCustomers ??
      data.top_customers ??
      []) as ReviewBoostOverviewData["topCustomers"],
    from: (data.from as string) || undefined,
    to: (data.to as string) || undefined,
  };
}

export async function verifyMarketingReview(
  id: string | number,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiUrl()}/marketing/reviews/${id}/verify`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return json.data;
}

export async function rejectMarketingReview(
  id: string | number,
  reason: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiUrl()}/marketing/reviews/${id}/reject`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return json.data;
}

export async function issueMarketingReviewReward(
  id: string | number,
  rewardId?: number | null,
): Promise<Record<string, unknown>> {
  const res = await authFetch(`${apiUrl()}/marketing/reviews/${id}/issue-reward`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      rewardId ? { reward_id: rewardId } : {},
    ),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return json.data;
}

export type MarketingRedemptionHistoryData = {
  redeemStats: ReviewBoostOverviewData["redeemStats"];
  redeemRows: ReviewBoostOverviewData["redeemRows"];
  from?: string;
  to?: string;
};

function normalizeRedeemRow(raw: Record<string, unknown>) {
  return {
    id: String(raw.id ?? ""),
    giftCode: String(raw.giftCode ?? raw.gift_code ?? "—"),
    orderCode: String(raw.orderCode ?? raw.order_code ?? "—"),
    customerName: String(raw.customerName ?? raw.customer_name ?? "—"),
    customerPhone: String(raw.customerPhone ?? raw.customer_phone ?? "—"),
    customerInitial: String(
      raw.customerInitial ?? raw.customer_initial ?? "?",
    ),
    channel: String(raw.channel ?? "other") as ReviewBoostOverviewData["redeemRows"][number]["channel"],
    branch: String(raw.branch ?? "—"),
    branchId: raw.branchId != null || raw.branch_id != null
      ? Number(raw.branchId ?? raw.branch_id)
      : null,
    giftName: String(raw.giftName ?? raw.gift_name ?? "Quà tặng"),
    giftEmoji: String(raw.giftEmoji ?? raw.gift_emoji ?? "🎁"),
    giftImageUrl: (raw.giftImageUrl ?? raw.gift_image_url ?? null) as
      | string
      | null,
    giftPrice: Number(raw.giftPrice ?? raw.gift_price ?? 0),
    redeemedAt: String(raw.redeemedAt ?? raw.redeemed_at ?? "—"),
    staffName: String(raw.staffName ?? raw.staff_name ?? "—"),
    staffInitial: String(raw.staffInitial ?? raw.staff_initial ?? "?"),
    status: (raw.status ?? "success") as ReviewBoostOverviewData["redeemRows"][number]["status"],
    note: (raw.note as string | null) ?? null,
  };
}

export async function fetchMarketingRedemptionHistory(
  filters: MarketingOverviewFilters = {},
  signal?: AbortSignal,
): Promise<MarketingRedemptionHistoryData> {
  const params = new URLSearchParams();
  if (filters.branch_id) params.set("branch_id", String(filters.branch_id));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  const qs = params.toString();
  const res = await fetch(
    `${apiUrl()}/marketing/reward-redemptions${qs ? `?${qs}` : ""}`,
    {
      headers: authHeaders(),
      cache: "no-store",
      signal,
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  const data = json.data ?? {};
  const statsRaw = (data.redeemStats ?? data.redeem_stats ?? {}) as Record<
    string,
    unknown
  >;
  const rowsRaw = (data.redeemRows ?? data.redeem_rows ?? []) as Record<
    string,
    unknown
  >[];

  return {
    redeemStats: {
      total: Number(statsRaw.total ?? 0),
      success: Number(statsRaw.success ?? 0),
      successPct: Number(statsRaw.successPct ?? statsRaw.success_pct ?? 0),
      processing: Number(statsRaw.processing ?? 0),
      processingPct: Number(
        statsRaw.processingPct ?? statsRaw.processing_pct ?? 0,
      ),
      failed: Number(statsRaw.failed ?? 0),
      failedPct: Number(statsRaw.failedPct ?? statsRaw.failed_pct ?? 0),
      totalValue: Number(statsRaw.totalValue ?? statsRaw.total_value ?? 0),
    },
    redeemRows: rowsRaw.map(normalizeRedeemRow),
    from: (data.from as string) || undefined,
    to: (data.to as string) || undefined,
  };
}

export type MarketingRewardCodeCheck = {
  valid: boolean;
  reason: string | null;
  missing_review: boolean;
  missing_review_message: string | null;
  provisional: boolean;
  id: number;
  code: string;
  status: string;
  expires_at: string | null;
  issued_at: string | null;
  redeemed_at: string | null;
  reward: {
    id: number;
    name: string;
    value: number;
    display_value: number;
    image_url: string | null;
  } | null;
  customer: { name: string | null; phone: string | null } | null;
  order: { order_code: string | null; rating: number | null } | null;
  branch: { id: number; name: string } | null;
};

export async function checkMarketingRewardCode(
  code: string,
  signal?: AbortSignal,
): Promise<MarketingRewardCodeCheck> {
  const res = await authFetch(`${apiUrl()}/marketing/reward-codes/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  const d = json.data ?? {};
  const reward = (d.reward ?? null) as Record<string, unknown> | null;
  const customer = (d.customer ?? null) as Record<string, unknown> | null;
  const order = (d.order ?? null) as Record<string, unknown> | null;
  const branch = (d.branch ?? null) as Record<string, unknown> | null;
  return {
    valid: Boolean(d.valid),
    reason: d.reason ? String(d.reason) : null,
    missing_review: Boolean(d.missing_review),
    missing_review_message: d.missing_review_message
      ? String(d.missing_review_message)
      : null,
    provisional: Boolean(d.provisional),
    id: Number(d.id),
    code: String(d.code ?? ""),
    status: String(d.status ?? ""),
    expires_at: d.expires_at ? String(d.expires_at) : null,
    issued_at: d.issued_at ? String(d.issued_at) : null,
    redeemed_at: d.redeemed_at ? String(d.redeemed_at) : null,
    reward: reward
      ? {
          id: Number(reward.id),
          name: String(reward.name ?? "Quà tặng"),
          value: Number(reward.value ?? 0),
          display_value: Number(
            reward.display_value ?? reward.value ?? 0,
          ),
          image_url: (reward.image_url as string | null) ?? null,
        }
      : null,
    customer: customer
      ? {
          name: (customer.name as string | null) ?? null,
          phone: (customer.phone as string | null) ?? null,
        }
      : null,
    order: order
      ? {
          order_code: (order.order_code as string | null) ?? null,
          rating: order.rating == null ? null : Number(order.rating),
        }
      : null,
    branch: branch
      ? { id: Number(branch.id), name: String(branch.name ?? "") }
      : null,
  };
}

export async function redeemMarketingRewardCode(
  id: number,
  payload: { branch_id: number; note?: string },
): Promise<void> {
  const res = await authFetch(`${apiUrl()}/marketing/reward-codes/${id}/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function updateMarketingRedemption(
  id: number | string,
  payload: { branch_id?: number; note?: string | null },
): Promise<void> {
  const res = await authFetch(`${apiUrl()}/marketing/reward-redemptions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function deleteMarketingRedemption(
  id: number | string,
): Promise<void> {
  const res = await authFetch(`${apiUrl()}/marketing/reward-redemptions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export type MarketingChannelDto = {
  id: number;
  name: string;
  code: string;
  color: string | null;
  icon: string | null;
  enabled: boolean;
  sort_order: number;
};

function normalizeChannel(raw: Record<string, unknown>): MarketingChannelDto {
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    code: String(raw.code ?? ""),
    color: (raw.color as string | null) ?? null,
    icon: (raw.icon as string | null) ?? null,
    enabled: Boolean(raw.enabled),
    sort_order: Number(raw.sort_order ?? raw.sortOrder ?? 0),
  };
}

async function parseChannels(res: Response): Promise<MarketingChannelDto[]> {
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: unknown };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map((row) => normalizeChannel(row as Record<string, unknown>));
}

export async function fetchMarketingChannels(
  signal?: AbortSignal,
): Promise<MarketingChannelDto[]> {
  const res = await authFetch(`${apiUrl()}/marketing/channels`, {
    cache: "no-store",
    signal,
  });
  return parseChannels(res);
}

export async function seedMarketingChannelDefaults(): Promise<MarketingChannelDto[]> {
  const res = await authFetch(`${apiUrl()}/marketing/channels/seed-defaults`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return parseChannels(res);
}

export async function createMarketingChannel(payload: {
  name: string;
  code?: string;
  color?: string | null;
  icon?: string | null;
  enabled?: boolean;
  sort_order?: number;
}): Promise<MarketingChannelDto> {
  const res = await authFetch(`${apiUrl()}/marketing/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      ...(payload.code ? { code: payload.code } : {}),
      color: payload.color ?? null,
      enabled: payload.enabled ?? true,
      sort_order: payload.sort_order,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeChannel(json.data);
}

export async function updateMarketingChannel(
  id: number | string,
  payload: Partial<{
    name: string;
    code: string;
    color: string | null;
    icon: string | null;
    enabled: boolean;
    sort_order: number;
  }>,
): Promise<MarketingChannelDto> {
  const res = await authFetch(`${apiUrl()}/marketing/channels/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeChannel(json.data);
}

export async function deleteMarketingChannel(
  id: number | string,
): Promise<void> {
  const res = await authFetch(`${apiUrl()}/marketing/channels/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function reorderMarketingChannels(
  ids: Array<number | string>,
): Promise<MarketingChannelDto[]> {
  const res = await authFetch(`${apiUrl()}/marketing/channels/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: ids.map(Number) }),
  });
  return parseChannels(res);
}

export type MarketingRewardDto = {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  image_url: string | null;
  sku: string | null;
  value: number;
  display_value: number;
  enabled: boolean;
  sort_order: number;
};

function normalizeReward(raw: Record<string, unknown>): MarketingRewardDto {
  const value = Number(raw.value ?? 0);
  const display = Number(raw.display_value ?? value);
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    description: (raw.description as string | null) ?? null,
    image: (raw.image as string | null) ?? null,
    image_url: (raw.image_url as string | null) ?? null,
    sku: (raw.sku as string | null) ?? null,
    value,
    display_value: display > 0 ? display : value,
    enabled: Boolean(raw.enabled),
    sort_order: Number(raw.sort_order ?? 0),
  };
}

async function parseRewards(res: Response): Promise<MarketingRewardDto[]> {
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: unknown };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map((row) => normalizeReward(row as Record<string, unknown>));
}

export async function fetchMarketingRewards(
  signal?: AbortSignal,
): Promise<MarketingRewardDto[]> {
  const res = await authFetch(`${apiUrl()}/marketing/rewards`, {
    cache: "no-store",
    signal,
  });
  return parseRewards(res);
}

export async function seedMarketingRewardDefaults(): Promise<MarketingRewardDto[]> {
  const res = await authFetch(`${apiUrl()}/marketing/rewards/seed-defaults`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return parseRewards(res);
}

export async function createMarketingReward(payload: {
  name: string;
  value?: number;
  display_value?: number;
  enabled?: boolean;
  sort_order?: number;
  description?: string | null;
}): Promise<MarketingRewardDto> {
  const res = await authFetch(`${apiUrl()}/marketing/rewards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeReward(json.data);
}

export async function updateMarketingReward(
  id: number | string,
  payload: Partial<{
    name: string;
    value: number;
    display_value: number;
    enabled: boolean;
    sort_order: number;
    description: string | null;
  }>,
): Promise<MarketingRewardDto> {
  const res = await authFetch(`${apiUrl()}/marketing/rewards/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeReward(json.data);
}

export async function deleteMarketingReward(
  id: number | string,
): Promise<void> {
  const res = await authFetch(`${apiUrl()}/marketing/rewards/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function uploadMarketingRewardImage(
  id: number | string,
  file: File,
): Promise<MarketingRewardDto> {
  const form = new FormData();
  form.append("image", file);
  const res = await authFetch(`${apiUrl()}/marketing/rewards/${id}/image`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeReward(json.data);
}

export async function clearMarketingRewardImage(
  id: number | string,
): Promise<MarketingRewardDto> {
  const res = await authFetch(`${apiUrl()}/marketing/rewards/${id}/image`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeReward(json.data);
}

export type MarketingBranchQrDto = {
  id: number;
  campaign_id: number;
  branch_id: number;
  branch_name: string;
  name: string;
  token: string;
  destination_type: string;
  enabled: boolean;
  public_url: string;
  public_path: string;
};

function normalizeBranchQr(raw: Record<string, unknown>): MarketingBranchQrDto {
  return {
    id: Number(raw.id),
    campaign_id: Number(raw.campaign_id),
    branch_id: Number(raw.branch_id),
    branch_name: String(raw.branch_name ?? "Chi nhánh"),
    name: String(raw.name ?? ""),
    token: String(raw.token ?? ""),
    destination_type: String(raw.destination_type ?? "ORDER_VERIFY"),
    enabled: Boolean(raw.enabled),
    public_url: String(raw.public_url ?? ""),
    public_path: String(raw.public_path ?? ""),
  };
}

export async function fetchMarketingBranchQrs(
  signal?: AbortSignal,
): Promise<MarketingBranchQrDto[]> {
  const res = await authFetch(`${apiUrl()}/marketing/qr-codes`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: unknown };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map((row) => normalizeBranchQr(row as Record<string, unknown>));
}

export async function ensureMarketingBranchQrs(): Promise<MarketingBranchQrDto[]> {
  const res = await authFetch(`${apiUrl()}/marketing/qr-codes/ensure-branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: unknown };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map((row) => normalizeBranchQr(row as Record<string, unknown>));
}

export type MarketingLandingAudioDto = {
  audio_url: string | null;
  file_name: string | null;
};

function normalizeLandingAudio(
  raw: Record<string, unknown> | null | undefined,
): MarketingLandingAudioDto {
  const url = raw?.audio_url;
  const name = raw?.file_name;
  return {
    audio_url: typeof url === "string" && url ? url : null,
    file_name: typeof name === "string" && name ? name : null,
  };
}

export async function fetchMarketingLandingAudio(
  signal?: AbortSignal,
): Promise<MarketingLandingAudioDto> {
  const res = await authFetch(`${apiUrl()}/marketing/landing/guide-audio`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeLandingAudio(json.data);
}

export async function fetchPublicLandingAudio(
  orgId: number | string,
  signal?: AbortSignal,
): Promise<MarketingLandingAudioDto> {
  const id = Number(orgId);
  if (!Number.isFinite(id) || id <= 0) {
    return { audio_url: null, file_name: null };
  }
  const res = await fetch(
    `${apiUrl()}/public/review-reward/guide-audio?org_id=${id}`,
    { cache: "no-store", signal },
  );
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeLandingAudio(json.data);
}

export async function uploadMarketingLandingAudio(
  file: File,
): Promise<MarketingLandingAudioDto> {
  const form = new FormData();
  form.append("audio", file);
  const res = await authFetch(`${apiUrl()}/marketing/landing/guide-audio`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeLandingAudio(json.data);
}

export async function clearMarketingLandingAudio(): Promise<MarketingLandingAudioDto> {
  const res = await authFetch(`${apiUrl()}/marketing/landing/guide-audio`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeLandingAudio(json.data);
}

export type MarketingLandingStyleDto = {
  style: Partial<{
    primary: string;
    secondary: string;
    background: string;
    text: string;
  }>;
  landing: Record<string, string | number>;
};

function normalizeLandingStyle(
  raw: Record<string, unknown> | null | undefined,
): MarketingLandingStyleDto {
  const styleRaw =
    raw?.style && typeof raw.style === "object"
      ? (raw.style as Record<string, unknown>)
      : {};
  const landingRaw =
    raw?.landing && typeof raw.landing === "object"
      ? (raw.landing as Record<string, unknown>)
      : {};
  const landing: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(landingRaw)) {
    if (typeof value === "string" || typeof value === "number") {
      landing[key] = value;
    }
  }
  return {
    style: {
      ...(typeof styleRaw.primary === "string" ? { primary: styleRaw.primary } : {}),
      ...(typeof styleRaw.secondary === "string"
        ? { secondary: styleRaw.secondary }
        : {}),
      ...(typeof styleRaw.background === "string"
        ? { background: styleRaw.background }
        : {}),
      ...(typeof styleRaw.text === "string" ? { text: styleRaw.text } : {}),
    },
    landing,
  };
}

export async function fetchMarketingLanding(
  signal?: AbortSignal,
): Promise<MarketingLandingStyleDto> {
  const res = await authFetch(`${apiUrl()}/marketing/landing`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeLandingStyle(json.data);
}

export async function updateMarketingLanding(payload: {
  style: Record<string, string>;
  landing: Record<string, unknown>;
}): Promise<MarketingLandingStyleDto> {
  const res = await authFetch(`${apiUrl()}/marketing/landing`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeLandingStyle(json.data);
}

export async function fetchPublicLanding(
  orgId: number | string,
  signal?: AbortSignal,
): Promise<MarketingLandingStyleDto> {
  const id = Number(orgId);
  if (!Number.isFinite(id) || id <= 0) {
    return { style: {}, landing: {} };
  }
  const res = await fetch(
    `${apiUrl()}/public/review-reward/landing?org_id=${id}`,
    { cache: "no-store", signal },
  );
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeLandingStyle(json.data);
}

export type MarketingRewardCodeSettingsDto = {
  prefix: string;
  pattern: string;
  length: number;
  use_letters: boolean;
  use_numbers: boolean;
  exclude_zero: boolean;
  exclude_o: boolean;
  exclude_i: boolean;
  exclude_one: boolean;
  expiry_type: string;
  expiry_days: number | null;
  expiry_date: string | null;
  reward_before_review: boolean;
};

function normalizeCodeSettings(
  raw: Record<string, unknown>,
): MarketingRewardCodeSettingsDto {
  return {
    prefix: String(raw.prefix ?? "GEN"),
    pattern: String(raw.pattern ?? "GEN-XXXX"),
    length: Number(raw.length ?? 4),
    use_letters: Boolean(raw.use_letters),
    use_numbers: Boolean(raw.use_numbers),
    exclude_zero: Boolean(raw.exclude_zero),
    exclude_o: Boolean(raw.exclude_o),
    exclude_i: Boolean(raw.exclude_i),
    exclude_one: Boolean(raw.exclude_one),
    expiry_type: String(raw.expiry_type ?? "DAYS"),
    expiry_days: raw.expiry_days == null ? null : Number(raw.expiry_days),
    expiry_date: raw.expiry_date ? String(raw.expiry_date) : null,
    reward_before_review: Boolean(raw.reward_before_review),
  };
}

export async function fetchMarketingRewardCodeSettings(
  signal?: AbortSignal,
): Promise<MarketingRewardCodeSettingsDto> {
  const res = await authFetch(`${apiUrl()}/marketing/reward-code-settings`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeCodeSettings(json.data);
}

export async function updateMarketingRewardCodeSettings(
  payload: Partial<MarketingRewardCodeSettingsDto>,
): Promise<MarketingRewardCodeSettingsDto> {
  const res = await authFetch(`${apiUrl()}/marketing/reward-code-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { data: Record<string, unknown> };
  return normalizeCodeSettings(json.data);
}

export type PublicSpinReward = {
  name: string;
  code: string;
  expires_at: string | null;
  image_url: string | null;
  display_value: number;
};

export type PublicSpinResult = {
  success: boolean;
  already_issued: boolean;
  provisional: boolean;
  reward: PublicSpinReward;
};

export async function spinPublicReviewReward(
  orgId: number | string,
  orderCode: string,
): Promise<PublicSpinResult> {
  const res = await fetch(`${apiUrl()}/public/review-reward/spin`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      org_id: Number(orgId),
      order_code: orderCode,
    }),
  });
  const json = (await res.json()) as PublicSpinResult & {
    message?: string;
    errors?: Record<string, string[]>;
  };
  if (!res.ok || !json.reward) {
    const first = json.errors
      ? Object.values(json.errors)[0]?.[0]
      : json.message;
    throw new Error(first || "Không quay thưởng được.");
  }
  return json;
}
