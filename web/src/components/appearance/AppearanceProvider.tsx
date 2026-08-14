"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getAccessToken } from "@/lib/api";
import {
  DEFAULT_APPEARANCE,
  applyAppearance,
  fetchInterfaceSettings,
  fetchUserPreferences,
  loadAppearance,
  saveAppearance,
  updateUserPreferences,
  type AppearanceSettings,
} from "@/lib/appearance";

type AppearanceContextValue = AppearanceSettings & {
  toggleSidebar: () => void;
};

const AppearanceContext = createContext<AppearanceContextValue>({
  ...DEFAULT_APPEARANCE,
  toggleSidebar: () => {},
});

export function useAppearance() {
  return useContext(AppearanceContext);
}

function sameAppearance(a: AppearanceSettings, b: AppearanceSettings) {
  return (
    a.theme === b.theme &&
    a.primary === b.primary &&
    a.secondary === b.secondary &&
    a.mode === b.mode &&
    a.sidebar === b.sidebar &&
    a.rounded === b.rounded &&
    a.animation === b.animation
  );
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const settingsRef = useRef(settings);
  const localAtBoot = useRef<AppearanceSettings | null>(null);
  const writeSeq = useRef(0);
  settingsRef.current = settings;

  useEffect(() => {
    const local = loadAppearance();
    localAtBoot.current = local;
    settingsRef.current = local;
    setSettings(local);
    applyAppearance(local);

    function onCustom(event: Event) {
      const next = (event as CustomEvent<AppearanceSettings>).detail;
      if (!next) return;
      setSettings((curr) => (sameAppearance(curr, next) ? curr : next));
      applyAppearance(next);
    }
    window.addEventListener("genky-appearance", onCustom);

    let cancelled = false;
    async function sync() {
      if (!getAccessToken()) return;
      try {
        const remote = await fetchInterfaceSettings({ persist: false });
        if (cancelled) return;

        let sidebar = settingsRef.current.sidebar;
        const boot = localAtBoot.current;
        const userToggled = boot ? settingsRef.current.sidebar !== boot.sidebar : false;

        if (!userToggled) {
          try {
            const prefs = await fetchUserPreferences();
            if (
              prefs.sidebar_style === "collapsed" ||
              prefs.sidebar_style === "expanded"
            ) {
              sidebar = prefs.sidebar_style;
            }
          } catch {
            /* giữ sidebar local */
          }
        } else {
          sidebar = settingsRef.current.sidebar;
        }

        if (cancelled) return;
        const next: AppearanceSettings = {
          ...remote,
          sidebar,
        };
        settingsRef.current = next;
        setSettings(next);
        saveAppearance(next);
      } catch {
        /* giữ bản local */
      }
    }
    void sync();

    return () => {
      cancelled = true;
      window.removeEventListener("genky-appearance", onCustom);
    };
  }, []);

  const toggleSidebar = useCallback(() => {
    const prev = settingsRef.current;
    const next: AppearanceSettings = {
      ...prev,
      sidebar: prev.sidebar === "collapsed" ? "expanded" : "collapsed",
    };
    settingsRef.current = next;
    setSettings(next);
    saveAppearance(next);

    if (!getAccessToken()) return;
    const seq = ++writeSeq.current;
    void updateUserPreferences({ sidebar_style: next.sidebar }).catch(() => {
      if (seq !== writeSeq.current) return;
    });
  }, []);

  return (
    <AppearanceContext.Provider value={{ ...settings, toggleSidebar }}>
      {children}
    </AppearanceContext.Provider>
  );
}
