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
  displayValue: number;
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

export type ReviewLandingCopy = {
  shopName: string;
  tagline: string;
  storeInfoLabel: string;
  thankYou: string;
  headline: string;
  headlineAccent: string;
  step1: string;
  step2: string;
  step3: string;
  badge: string;
  expiry: string;
  formTitle: string;
  formHint: string;
  orderPlaceholder: string;
  confirmLabel: string;
  orderHelp: string;
  orderGuide: string;
  giftsTitle: string;
  notesTitle: string;
  notes: string;
  footerTitle: string;
  footerText: string;
  fontFamily: string;
  buttonRadius: number;
  guideAudioUrl: string | null;
  guideAudioName: string;
  guideAudioLabel: string;
  winTitle: string;
  winMessage: string;
  buyNowLabel: string;
  buyNowUrl: string;
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
  rewardBeforeReview: boolean;
  qrMode: ReviewQrMode;
  qrUrl: string;
  style: ReviewStyleSettings;
  landing: ReviewLandingCopy;
  reviewUrl: string;
  note: string;
};

const STORAGE_PREFIX = "genky_review_boost_settings_v1";
const PREVIEW_PREFIX = "genky_review_landing_preview";

export function defaultReviewLandingCopy(): ReviewLandingCopy {
  return {
    shopName: "TÊN CỬA HÀNG",
    tagline: "Khách hàng là người thân ❤️",
    storeInfoLabel: "Thông tin cửa hàng",
    thankYou: "CẢM ƠN BẠN ĐÃ ỦNG HỘ!",
    headline: "NHẬN QUÀ LIỀN TAY",
    headlineAccent: "MUA HÀNG 5⭐",
    step1: "Đặt hàng trên ShopeeFood",
    step2: "Đánh giá 5⭐ kèm hình ảnh",
    step3: "Nhập mã đơn nhận thưởng",
    badge: "Ngon khó cưỡng!",
    expiry: "Chương trình áp dụng đến hết 31/12/2026",
    formTitle: "NHẬP MÃ ĐƠN – NHẬN THƯỞNG",
    formHint: "Nhập mã đơn hàng của bạn để nhận thưởng",
    orderPlaceholder: "Nhập mã đơn hàng tại đây...",
    confirmLabel: "Quay Thưởng",
    orderHelp: "Mã đơn thường bắt đầu bằng # hoặc SPX.",
    orderGuide: "Hướng dẫn lấy mã đơn hàng >",
    giftsTitle: "PHẦN QUÀ TẶNG",
    notesTitle: "LƯU Ý",
    notes:
      "Áp dụng cho đơn hàng ShopeeFood.\nCần đánh giá 5 sao kèm hình ảnh.\nMỗi mã đơn chỉ được dùng 1 lần.\nQuà tặng gửi kèm đơn hàng tiếp theo.",
    footerTitle: "❤️ Cảm ơn bạn đã ủng hộ!",
    footerText: "Chúng tôi luôn cố gắng mang đến món ngon và dịch vụ tốt nhất.",
    fontFamily: '"Be Vietnam Pro", "Inter", sans-serif',
    buttonRadius: 16,
    guideAudioUrl: null,
    guideAudioName: "",
    guideAudioLabel: "Nghe hướng dẫn nhận thưởng",
    winTitle: "CHÚC MỪNG!",
    winMessage: "Bạn đã quay trúng phần quà từ quán. Ghi chú mã tặng cho đơn tới nhé!",
    buyNowLabel: "Mua ngay",
    buyNowUrl: "",
  };
}

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
    rewardBeforeReview: false,
    qrMode: "order",
    qrUrl: "https://genky.vn/review/verify",
    style: {
      primary: "#FF6D00",
      secondary: "#00B14F",
      background: "#FFF8F3",
      text: "#212121",
    },
    landing: defaultReviewLandingCopy(),
    reviewUrl: "",
    note: "",
  };
}

function key(orgId: number | string): string {
  return `${STORAGE_PREFIX}:${orgId}`;
}

function mergeLandingCopy(
  base: ReviewLandingCopy,
  patch?: Partial<ReviewLandingCopy>,
): ReviewLandingCopy {
  const landing = { ...base, ...(patch ?? {}) };
  if (!patch?.confirmLabel || patch.confirmLabel === "Xác nhận") {
    landing.confirmLabel = base.confirmLabel;
  }
  if (
    !patch?.winMessage ||
    patch.winMessage ===
      "Bạn đã quay trúng phần quà từ quán. Giữ mã để đổi khi đặt đơn tiếp theo nhé!" ||
    patch.winMessage === "Bạn đã quay trúng phần quà từ quán."
  ) {
    landing.winMessage = base.winMessage;
  }
  return landing;
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
      landing: mergeLandingCopy(base.landing, parsed.landing),
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

function previewKey(orgId: number | string): string {
  return `${PREVIEW_PREFIX}:${orgId}`;
}

export function writeReviewLandingPreviewDraft(
  orgId: number | string,
  settings: ReviewBoostFullSettings,
): void {
  window.localStorage.setItem(previewKey(orgId), JSON.stringify(settings));
}

export function readReviewLandingPreviewDraft(
  orgId: number | string,
): ReviewBoostFullSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(previewKey(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReviewBoostFullSettings>;
    const base = defaultReviewBoostSettings();
    return {
      ...base,
      ...parsed,
      style: { ...base.style, ...(parsed.style ?? {}) },
      landing: mergeLandingCopy(base.landing, parsed.landing),
      channels: parsed.channels ?? base.channels,
      gifts: parsed.gifts ?? base.gifts,
    };
  } catch {
    return null;
  }
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
