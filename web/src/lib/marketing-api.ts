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
  return json.data;
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
  enabled: boolean;
  sort_order: number;
};

function normalizeReward(raw: Record<string, unknown>): MarketingRewardDto {
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    description: (raw.description as string | null) ?? null,
    image: (raw.image as string | null) ?? null,
    image_url: (raw.image_url as string | null) ?? null,
    sku: (raw.sku as string | null) ?? null,
    value: Number(raw.value ?? 0),
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
