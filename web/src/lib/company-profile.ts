export type CompanyProfile = {
  tax_code: string;
  company_type: string;
  company_size: string;
  email: string;
  website: string;
  fax: string;
  hotline: string;
  representative: string;
  representative_title: string;
  established_at: string;
  industry: string;
  intro: string;
  logo_data_url: string | null;
};

export type LegalDocument = {
  id: string;
  name: string;
  size_label: string;
};

const PROFILE_KEY = "genky_company_profile";
const DOCS_KEY = "genky_company_docs";

const emptyProfile: CompanyProfile = {
  tax_code: "",
  company_type: "Công ty TNHH",
  company_size: "10 - 50 nhân viên",
  email: "",
  website: "",
  fax: "",
  hotline: "",
  representative: "",
  representative_title: "Chủ sở hữu",
  established_at: "",
  industry: "F&B / Nhà hàng",
  intro: "",
  logo_data_url: null,
};

function storageKey(base: string, orgId: number) {
  return `${base}_${orgId}`;
}

export function loadCompanyProfile(orgId: number): CompanyProfile {
  if (typeof window === "undefined") return emptyProfile;
  try {
    const raw = localStorage.getItem(storageKey(PROFILE_KEY, orgId));
    if (!raw) return { ...emptyProfile };
    return { ...emptyProfile, ...(JSON.parse(raw) as Partial<CompanyProfile>) };
  } catch {
    return { ...emptyProfile };
  }
}

export function saveCompanyProfile(orgId: number, profile: CompanyProfile) {
  localStorage.setItem(storageKey(PROFILE_KEY, orgId), JSON.stringify(profile));
}

export function loadLegalDocuments(orgId: number): LegalDocument[] {
  if (typeof window === "undefined") return defaultDocs();
  try {
    const raw = localStorage.getItem(storageKey(DOCS_KEY, orgId));
    if (!raw) return defaultDocs();
    return JSON.parse(raw) as LegalDocument[];
  } catch {
    return defaultDocs();
  }
}

export function saveLegalDocuments(orgId: number, docs: LegalDocument[]) {
  localStorage.setItem(storageKey(DOCS_KEY, orgId), JSON.stringify(docs));
}

function defaultDocs(): LegalDocument[] {
  return [
    { id: "1", name: "Giấy phép kinh doanh.pdf", size_label: "1.2 MB" },
    { id: "2", name: "Giấy chứng nhận MST.pdf", size_label: "840 KB" },
  ];
}
