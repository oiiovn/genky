export type ReviewChannelSetting = {
  id: string;
  /** Mã kênh (unique theo org) — map DB `code` */
  code: string;
  name: string;
  color: string;
  icon: string;
  enabled: boolean;
  sort_order: number;
};

export type ReviewGiftItemSetting = {
  id: string;
  name: string;
  imageUrl: string | null;
  value: number;
  enabled: boolean;
  sort_order: number;
};

export type ReviewCodeFormatId =
  | "gen4"
  | "gen6"
  | "xxxx"
  | "custom";

export type ReviewExpireMode = "after_days" | "fixed_date" | "never";

export type ReviewQrMode = "order" | "landing" | "custom";

export type ReviewStyleSettings = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
};

export type ReviewBoostFullSettings = {
  channels: ReviewChannelSetting[];
  gifts: ReviewGiftItemSetting[];
  codeFormat: ReviewCodeFormatId;
  codePrefix: string;
  codeLength: number;
  useLetters: boolean;
  useDigits: boolean;
  excludeAmbiguous: boolean;
  expireMode: ReviewExpireMode;
  expireDays: number;
  expireFixedDate: string;
  qrMode: ReviewQrMode;
  qrUrl: string;
  style: ReviewStyleSettings;
  reviewUrl: string;
  note: string;
};

const STORAGE_PREFIX = "genky_review_boost_settings_v1";

export function defaultReviewBoostSettings(): ReviewBoostFullSettings {
  return {
    channels: [
      {
        id: "shopee_food",
        code: "SHOPEEFOOD",
        name: "ShopeeFood",
        color: "#FF4E00",
        icon: "utensils",
        enabled: true,
        sort_order: 1,
      },
      {
        id: "grab_food",
        code: "GRABFOOD",
        name: "GrabFood",
        color: "#00B14F",
        icon: "bike",
        enabled: true,
        sort_order: 2,
      },
    ],
    gifts: [],
    codeFormat: "gen4",
    codePrefix: "GEN",
    codeLength: 4,
    useLetters: true,
    useDigits: true,
    excludeAmbiguous: true,
    expireMode: "after_days",
    expireDays: 7,
    expireFixedDate: "",
    qrMode: "order",
    qrUrl: "https://genky.vn/review/verify",
    style: {
      primary: "#FF6D00",
      secondary: "#00B14F",
      background: "#FFF8F3",
      text: "#212121",
    },
    reviewUrl: "",
    note: "",
  };
}

function key(orgId: number | string): string {
  return `${STORAGE_PREFIX}:${orgId}`;
}

export function loadReviewBoostSettings(
  orgId: number | string,
): ReviewBoostFullSettings {
  const base = defaultReviewBoostSettings();
  // Channels + gifts luôn lấy từ API — không hydrate từ localStorage.
  const withoutLocalCatalog: ReviewBoostFullSettings = {
    ...base,
    channels: [],
    gifts: [],
  };
  if (typeof window === "undefined") return withoutLocalCatalog;
  try {
    const raw = window.localStorage.getItem(key(orgId));
    if (!raw) return withoutLocalCatalog;
    const parsed = JSON.parse(raw) as Partial<ReviewBoostFullSettings>;
    return {
      ...base,
      ...parsed,
      channels: [],
      gifts: [],
      style: { ...base.style, ...(parsed.style ?? {}) },
    };
  } catch {
    return withoutLocalCatalog;
  }
}

export function saveReviewBoostSettings(
  orgId: number | string,
  settings: ReviewBoostFullSettings,
): void {
  // Không lưu channels/gifts — nguồn sự thật là API.
  const { channels: _channels, gifts: _gifts, ...rest } = settings;
  window.localStorage.setItem(
    key(orgId),
    JSON.stringify({ ...rest, channels: [], gifts: [] }),
  );
}

export function previewGiftCode(settings: ReviewBoostFullSettings): string {
  const alphabetLetters = settings.excludeAmbiguous
    ? "ABCDEFGHJKLMNPQRSTUVWXYZ"
    : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const alphabetDigits = settings.excludeAmbiguous ? "23456789" : "0123456789";
  let pool = "";
  if (settings.useLetters) pool += alphabetLetters;
  if (settings.useDigits) pool += alphabetDigits;
  if (!pool) pool = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const pick = (n: number) => {
    let out = "";
    for (let i = 0; i < n; i++) {
      out += pool[Math.floor((i * 7 + 3) % pool.length)];
    }
    return out;
  };

  if (settings.codeFormat === "gen4") return `GEN-${pick(4)}`;
  if (settings.codeFormat === "gen6") return `GEN-${pick(6)}`;
  if (settings.codeFormat === "xxxx") return `${pick(4)}-${pick(4)}`;
  const prefix = (settings.codePrefix || "GEN").toUpperCase();
  return `${prefix}-${pick(settings.codeLength || 4)}`;
}
