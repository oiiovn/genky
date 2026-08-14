import { getAccessToken } from "@/lib/api";
import { apiUrl } from "@/lib/api-base";

export type PlanTone = "blue" | "purple" | "orange" | "green";

export type UpgradePlan = {
  id: number | null;
  code: string;
  name: string;
  tagline: string;
  tone: PlanTone;
  popular: boolean;
  contact_only: boolean;
  price_monthly: number | null;
  price_yearly: number | null;
  price_yearly_full: number | null;
  savings_yearly: number | null;
  max_employees: number | null;
  max_branches: number | null;
  highlights: string[];
  is_current: boolean;
};

export type PlansCatalog = {
  billing_cycle: string;
  trial_days: number;
  current_plan: { code: string; name: string } | null;
  plans: UpgradePlan[];
};

function authHeaders(json = true): HeadersInit {
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
      if (first?.[0]) return first[0];
    }
    if (data.message) return data.message as string;
  } catch {
    /* ignore */
  }
  return "Có lỗi xảy ra, vui lòng thử lại.";
}

export async function fetchPlansCatalog(): Promise<PlansCatalog> {
  const res = await fetch(`${apiUrl()}/plans`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export function formatVnd(amount: number | null | undefined): string {
  if (amount == null) return "Liên hệ";
  return `${amount.toLocaleString("vi-VN")}đ`;
}
