export type BranchExtra = {
  email: string;
  hours: string;
  manager_name: string;
  wifi: string;
  allow_offsite: boolean;
  notes: string;
};

const KEY = "genky_branch_extra";

const defaults: BranchExtra = {
  email: "",
  hours: "08:00 - 22:00",
  manager_name: "",
  wifi: "",
  allow_offsite: false,
  notes: "",
};

export function loadBranchExtra(branchId: number): BranchExtra {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = localStorage.getItem(`${KEY}_${branchId}`);
    if (!raw) return { ...defaults };
    return { ...defaults, ...(JSON.parse(raw) as Partial<BranchExtra>) };
  } catch {
    return { ...defaults };
  }
}

export function saveBranchExtra(branchId: number, extra: BranchExtra) {
  localStorage.setItem(`${KEY}_${branchId}`, JSON.stringify(extra));
}
