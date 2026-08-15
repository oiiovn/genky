/**
 * Luồng nghiệp vụ Gia tăng đánh giá (canonical) — tham chiếu nội bộ.
 * Không render strip trên UI Tổng quan.
 *
 * Campaign → Review 5★ → Validation → Verification → Reward Code
 * → Customer QR → Order Code Verification → Show Reward Code
 * → Employee Check → Redemption → History / Analytics
 */

export type ReviewFlowStageId =
  | "campaign"
  | "review_5star"
  | "validation"
  | "verification"
  | "reward_code"
  | "customer_qr"
  | "order_verify"
  | "show_reward"
  | "employee_check"
  | "redemption"
  | "history";

export type ReviewFlowStage = {
  id: ReviewFlowStageId;
  label: string;
  short: string;
  adminTab?: "overview" | "reviews" | "history" | "settings";
  publicPath?: string;
  actor: "admin" | "system" | "customer" | "staff";
};

export const REVIEW_FLOW_STAGES: ReviewFlowStage[] = [
  {
    id: "campaign",
    label: "Chiến dịch",
    short: "Campaign",
    adminTab: "overview",
    actor: "admin",
  },
  {
    id: "review_5star",
    label: "Đánh giá 5★",
    short: "Review 5★",
    adminTab: "reviews",
    actor: "customer",
  },
  {
    id: "validation",
    label: "Kiểm tra hợp lệ",
    short: "Validation",
    adminTab: "reviews",
    actor: "system",
  },
  {
    id: "verification",
    label: "Xác minh",
    short: "Verification",
    adminTab: "reviews",
    actor: "admin",
  },
  {
    id: "reward_code",
    label: "Cấp mã tặng",
    short: "Reward Code",
    adminTab: "reviews",
    actor: "system",
  },
  {
    id: "customer_qr",
    label: "QR khách",
    short: "Customer QR",
    adminTab: "settings",
    publicPath: "/review/verify",
    actor: "customer",
  },
  {
    id: "order_verify",
    label: "Xác minh mã đơn",
    short: "Order Verify",
    publicPath: "/review/verify",
    actor: "customer",
  },
  {
    id: "show_reward",
    label: "Hiện mã quà",
    short: "Show Reward",
    publicPath: "/review/verify",
    actor: "customer",
  },
  {
    id: "employee_check",
    label: "NV kiểm tra",
    short: "Staff Check",
    adminTab: "history",
    actor: "staff",
  },
  {
    id: "redemption",
    label: "Đổi quà",
    short: "Redemption",
    adminTab: "history",
    actor: "staff",
  },
  {
    id: "history",
    label: "Lịch sử / Phân tích",
    short: "History",
    adminTab: "history",
    actor: "admin",
  },
];
