import { SettingsChrome } from "@/components/settings/SettingsFrame";
import { SettingsShell } from "@/components/settings/SettingsContext";
import { isSettingsSection, resolveSettingsPath } from "@/lib/settings";
import { redirect } from "next/navigation";

export default async function SettingsSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isSettingsSection(section)) {
    redirect(resolveSettingsPath(section));
  }

  return (
    <SettingsShell>
      <SettingsChrome>{children}</SettingsChrome>
    </SettingsShell>
  );
}
