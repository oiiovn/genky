import { redirect } from "next/navigation";
import { resolveSettingsPath } from "@/lib/settings";

export default async function SettingsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(resolveSettingsPath(tab));
}
