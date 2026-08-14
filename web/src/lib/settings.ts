export const SETTINGS_SECTIONS = [
  "general",
  "company",
  "branches",
  "security",
  "activity",
  "appearance",
  "notifications",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const ALIASES: Record<string, string> = {
  logs: "activity",
  interface: "appearance",
  tab: "general",
};

const MODULE_REDIRECTS: Record<string, string> = {
  shifts: "/shifts",
  attendance: "/attendance",
};

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function settingsPath(section: SettingsSection): string {
  return `/settings/${section}`;
}

/** Chuẩn hóa slug cũ (?tab=, logs, interface) thành đường dẫn. */
export function resolveSettingsPath(raw?: string | null): string {
  const key = (raw ?? "general").trim().toLowerCase();
  if (MODULE_REDIRECTS[key]) return MODULE_REDIRECTS[key];
  const mapped = ALIASES[key] ?? key;
  if (isSettingsSection(mapped)) return settingsPath(mapped);
  return settingsPath("general");
}
