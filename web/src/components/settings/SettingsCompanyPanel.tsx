"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  Download,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  deleteOrganizationDocument,
  downloadOrganizationDocument,
  fetchOrganizationLogoSrc,
  updateOrganization,
  uploadOrganizationDocument,
  uploadOrganizationLogo,
  type AuthOrganization,
  type OrganizationDocument,
} from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const TYPES = ["Công ty TNHH", "Công ty cổ phần", "Hộ kinh doanh", "Doanh nghiệp tư nhân"];
const SIZES = [
  "1 - 10 nhân viên",
  "10 - 50 nhân viên",
  "50 - 200 nhân viên",
  "Trên 200 nhân viên",
];
const INDUSTRIES = [
  "F&B / Nhà hàng",
  "Bán lẻ",
  "Dịch vụ",
  "Sản xuất",
  "Công nghệ",
  "Khác",
];

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400";

function fromOrg(organization: AuthOrganization) {
  return {
    name: organization.name ?? "",
    phone: organization.phone ?? "",
    address: organization.address ?? "",
    tax_code: organization.tax_code ?? "",
    company_type: organization.company_type || TYPES[0],
    company_size: organization.company_size || SIZES[1],
    email: organization.email ?? "",
    website: organization.website ?? "",
    fax: organization.fax ?? "",
    hotline: organization.hotline ?? "",
    representative: organization.representative ?? "",
    representative_title: organization.representative_title || "Chủ sở hữu",
    established_at: organization.established_at ?? "",
    industry: organization.industry || INDUSTRIES[0],
    intro: organization.intro ?? "",
    logo_url: null as string | null,
  };
}

export function SettingsCompanyPanel({
  organization,
  onSaved,
  onToast,
}: {
  organization: AuthOrganization;
  onSaved: (org: AuthOrganization) => void;
  onToast: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const initial = fromOrg(organization);
  const [form, setForm] = useState(initial);
  const [docs, setDocs] = useState<OrganizationDocument[]>(
    organization.documents ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDoc, setPendingDoc] = useState<OrganizationDocument | null>(
    null,
  );
  const [deletingDoc, setDeletingDoc] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    async function loadLogo() {
      const src = await fetchOrganizationLogoSrc();
      if (cancelled || !src) return;
      objectUrl = src;
      setForm((prev) => ({ ...prev, logo_url: src }));
    }
    void loadLogo();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [organization.id, organization.logo_url]);

  function patch(partial: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const org = await updateOrganization({
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        tax_code: form.tax_code.trim(),
        company_type: form.company_type,
        company_size: form.company_size,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        fax: form.fax.trim() || null,
        hotline: form.hotline.trim() || null,
        representative: form.representative.trim() || null,
        representative_title: form.representative_title.trim() || null,
        established_at: form.established_at || null,
        industry: form.industry,
        intro: form.intro.trim() || null,
      });
      onSaved({ ...org, documents: docs });
      onToast("Đã lưu thông tin công ty");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu.");
    } finally {
      setSaving(false);
    }
  }

  async function onLogoChange(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      setError("Logo tối đa 8MB.");
      return;
    }
    const preview = URL.createObjectURL(file);
    patch({ logo_url: preview });
    try {
      const org = await uploadOrganizationLogo(file);
      const src = await fetchOrganizationLogoSrc();
      patch({ logo_url: src ?? preview });
      onSaved({ ...org, documents: docs });
      onToast("Đã cập nhật logo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được logo.");
    }
  }

  async function onAddDocument(file: File) {
    try {
      const doc = await uploadOrganizationDocument(file);
      setDocs((prev) => [doc, ...prev]);
      onToast("Đã thêm tài liệu");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tài liệu.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 xl:flex-row">
      <div className="min-w-0 flex-1 space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Thông tin cơ bản</h3>
          <p className="mt-1 text-sm text-slate-500">
            Tên, mã số thuế và quy mô doanh nghiệp
          </p>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-center text-[11px] font-bold text-white">
              {form.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logo_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-2 leading-tight">{form.name || "Logo"}</span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Logo công ty</p>
              <p className="text-xs text-slate-400">PNG, JPG · tối đa 8MB</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Đổi logo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onLogoChange(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tên công ty" required>
              <input
                required
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Mã số thuế" required>
              <input
                required
                value={form.tax_code}
                onChange={(e) => patch({ tax_code: e.target.value })}
                className={inputClass}
                placeholder="0xxxxxxxxxx"
              />
            </Field>
            <Field label="Loại hình">
              <select
                value={form.company_type}
                onChange={(e) => patch({ company_type: e.target.value })}
                className={inputClass}
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Quy mô">
              <select
                value={form.company_size}
                onChange={(e) => patch({ company_size: e.target.value })}
                className={inputClass}
              >
                {SIZES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Thông tin liên hệ</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Địa chỉ" required>
                <input
                  required
                  value={form.address}
                  onChange={(e) => patch({ address: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Điện thoại" required>
              <input
                required
                value={form.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Email" required>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => patch({ email: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Website">
              <input
                value={form.website}
                onChange={(e) => patch({ website: e.target.value })}
                className={inputClass}
                placeholder="https://"
              />
            </Field>
            <Field label="Fax">
              <input
                value={form.fax}
                onChange={(e) => patch({ fax: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Hotline">
              <input
                value={form.hotline}
                onChange={(e) => patch({ hotline: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Thông tin khác</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Người đại diện">
              <input
                value={form.representative}
                onChange={(e) => patch({ representative: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Chức vụ">
              <input
                value={form.representative_title}
                onChange={(e) =>
                  patch({ representative_title: e.target.value })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Ngày thành lập">
              <input
                type="date"
                value={form.established_at}
                onChange={(e) => patch({ established_at: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Ngành nghề">
              <select
                value={form.industry}
                onChange={(e) => patch({ industry: e.target.value })}
                className={inputClass}
              >
                {INDUSTRIES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Giới thiệu công ty">
                <textarea
                  rows={4}
                  value={form.intro}
                  onChange={(e) => patch({ intro: e.target.value })}
                  className={inputClass}
                  placeholder="Mô tả ngắn về công ty..."
                />
              </Field>
            </div>
          </div>

          {error ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setForm(fromOrg(organization))}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </section>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[280px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Xem trước</h3>
          <p className="mt-1 text-xs text-slate-400">
            Hiển thị trên báo cáo và tài liệu
          </p>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[9px] font-bold text-white">
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logo_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">
                  {form.name || "Tên công ty"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {form.company_type}
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>{form.address || "Chưa có địa chỉ"}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                {form.phone || "—"}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {form.email || "—"}
              </li>
              <li className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-slate-400" />
                {form.website || "—"}
              </li>
              <li className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                MST: {form.tax_code || "—"}
              </li>
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Tài liệu pháp lý</h3>
          <ul className="mt-3 space-y-2">
            {docs.length === 0 ? (
              <li className="text-sm text-slate-400">Chưa có tài liệu.</li>
            ) : (
              docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {doc.name}
                    </p>
                    <p className="text-[11px] text-slate-400">{doc.size_label}</p>
                  </div>
                  <button
                    type="button"
                    title="Tải xuống"
                    onClick={() =>
                      void downloadOrganizationDocument(doc.id, doc.name)
                    }
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Xóa"
                    onClick={() => setPendingDoc(doc)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))
            )}
          </ul>
          <input
            ref={docRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onAddDocument(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => docRef.current?.click()}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            <Plus className="h-4 w-4" />
            Thêm tài liệu
          </button>
        </section>
      </aside>
      <ConfirmDialog
        open={pendingDoc !== null}
        title="Xóa tài liệu"
        message={`Xóa tài liệu “${pendingDoc?.name ?? ""}”?`}
        loading={deletingDoc}
        onClose={() => {
          if (!deletingDoc) setPendingDoc(null);
        }}
        onConfirm={() => {
          if (!pendingDoc) return;
          setDeletingDoc(true);
          void deleteOrganizationDocument(pendingDoc.id)
            .then(() => {
              setDocs((prev) => prev.filter((d) => d.id !== pendingDoc.id));
              onToast("Đã xóa tài liệu");
              setPendingDoc(null);
            })
            .catch((e: Error) => onToast(e.message))
            .finally(() => setDeletingDoc(false));
        }}
      />
    </form>
  );
}
