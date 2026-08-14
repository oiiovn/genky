"use client";

import { useParams } from "next/navigation";
import { SettingsBranchesPanel } from "@/components/settings/SettingsBranchesPanel";
import { SettingsCompanyPanel } from "@/components/settings/SettingsCompanyPanel";
import { SettingsGeneralPanel } from "@/components/settings/SettingsGeneralPanel";
import { SettingsInterfacePanel } from "@/components/settings/SettingsInterfacePanel";
import { SettingsLogsPanel } from "@/components/settings/SettingsLogsPanel";
import { SettingsPlaceholder } from "@/components/settings/SettingsCategoryNav";
import { SettingsSecurityPanel } from "@/components/settings/SettingsSecurityPanel";
import { useSettingsData } from "@/components/settings/SettingsContext";
import { isSettingsSection, type SettingsSection } from "@/lib/settings";

const META: Record<
  Exclude<SettingsSection, "general">,
  { title: string; description: string }
> = {
  company: {
    title: "Thông tin công ty",
    description: "Cập nhật hồ sơ tổ chức, MST và thông tin liên hệ.",
  },
  branches: {
    title: "Chi nhánh",
    description: "Quản lý chi nhánh, địa chỉ và bán kính chấm công.",
  },
  security: {
    title: "Tài khoản & Bảo mật",
    description: "Mật khẩu, phiên đăng nhập và xác thực 2 bước.",
  },
  activity: {
    title: "Nhật ký hệ thống",
    description: "Theo dõi thao tác người dùng và sự kiện hệ thống.",
  },
  appearance: {
    title: "Giao diện",
    description: "Ngôn ngữ, định dạng ngày và tuỳ chọn hiển thị.",
  },
  notifications: {
    title: "Thông báo",
    description: "Email, push và cảnh báo trong ứng dụng.",
  },
};

export default function SettingsSectionPage() {
  const params = useParams<{ section: string }>();
  const slug = params.section;
  const {
    organization,
    user,
    branches,
    employees,
    shifts,
    showToast,
    setOrganization,
    setBranches,
    setUser,
  } = useSettingsData();

  if (!slug || !isSettingsSection(slug)) {
    return null;
  }

  if (slug === "general") {
    return (
      <SettingsGeneralPanel
        organization={organization}
        branches={branches}
        onToast={showToast}
      />
    );
  }

  if (slug === "company") {
    if (!organization) {
      return (
        <SettingsPlaceholder
          title={META.company.title}
          description="Không tải được thông tin công ty."
        />
      );
    }
    return (
      <SettingsCompanyPanel
        organization={organization}
        onSaved={setOrganization}
        onToast={showToast}
      />
    );
  }

  if (slug === "branches") {
    return (
      <SettingsBranchesPanel
        branches={branches}
        employees={employees}
        shifts={shifts}
        onChanged={setBranches}
        onToast={showToast}
      />
    );
  }

  if (slug === "security") {
    if (!user) {
      return (
        <SettingsPlaceholder
          title={META.security.title}
          description="Không tải được tài khoản."
        />
      );
    }
    return (
      <SettingsSecurityPanel
        user={user}
        onUserChange={setUser}
        onToast={showToast}
      />
    );
  }

  if (slug === "activity") {
    return <SettingsLogsPanel user={user} onToast={showToast} />;
  }

  if (slug === "appearance") {
    return <SettingsInterfacePanel onToast={showToast} />;
  }

  return (
    <div className="space-y-4">
      <SettingsPlaceholder
        title={META[slug].title}
        description={META[slug].description}
      />
      <button
        type="button"
        onClick={() => showToast("Màn hình chi tiết sắp có")}
        className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
      >
        Sắp có cấu hình chi tiết
      </button>
    </div>
  );
}
