export type ReviewBoostConfig = {
  reviewUrl: string;
  note: string;
  updatedAt: string | null;
};

const STORAGE_PREFIX = "genky_review_boost_v1";

function storageKey(orgId: number | string, branchId: number): string {
  return `${STORAGE_PREFIX}:${orgId}:${branchId}`;
}

export function emptyReviewBoostConfig(): ReviewBoostConfig {
  return { reviewUrl: "", note: "", updatedAt: null };
}

export function loadReviewBoostConfig(
  orgId: number | string,
  branchId: number,
): ReviewBoostConfig {
  if (typeof window === "undefined") return emptyReviewBoostConfig();
  try {
    const raw = window.localStorage.getItem(storageKey(orgId, branchId));
    if (!raw) return emptyReviewBoostConfig();
    const parsed = JSON.parse(raw) as Partial<ReviewBoostConfig>;
    return {
      reviewUrl: String(parsed.reviewUrl ?? "").trim(),
      note: String(parsed.note ?? ""),
      updatedAt: parsed.updatedAt ? String(parsed.updatedAt) : null,
    };
  } catch {
    return emptyReviewBoostConfig();
  }
}

export function saveReviewBoostConfig(
  orgId: number | string,
  branchId: number,
  config: Pick<ReviewBoostConfig, "reviewUrl" | "note">,
): ReviewBoostConfig {
  const next: ReviewBoostConfig = {
    reviewUrl: config.reviewUrl.trim(),
    note: config.note.trim(),
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(storageKey(orgId, branchId), JSON.stringify(next));
  return next;
}

/** Chuẩn hóa URL đánh giá Google / Maps nếu người dùng dán thiếu protocol. */
export function normalizeReviewUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(g\.page|maps\.app\.goo\.gl|maps\.google\.|www\.google\.|google\.)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isLikelyReviewUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(normalizeReviewUrl(url));
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}
