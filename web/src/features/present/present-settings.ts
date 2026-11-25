export type PresentTheme = "light" | "dark";
export type PresentFont = "standard" | "large" | "huge";
export type PresentAccent = "primary" | "success" | "warning";

export type PresentSettings = {
  theme: PresentTheme;
  font: PresentFont;
  accent: PresentAccent;
  showLogo: boolean;
};

export const PRESENT_SETTINGS_KEY = "qevent.present.settings";

export const defaultPresentSettings: PresentSettings = {
  theme: "light",
  font: "standard",
  accent: "primary",
  showLogo: true,
};

export const FONT_PX: Record<PresentFont, number> = {
  standard: 16,
  large: 20,
  huge: 24,
};

export const ACCENT_VAR: Record<PresentAccent, string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
};

/** Unknown or partial stored values fall back per field, so a stale localStorage entry never breaks the screen. */
export function parsePresentSettings(raw: string | null): PresentSettings {
  if (!raw) return defaultPresentSettings;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof PresentSettings, unknown>>;
    return {
      theme: value.theme === "dark" ? "dark" : "light",
      font: value.font === "large" ? "large" : value.font === "huge" ? "huge" : "standard",
      accent:
        value.accent === "success" ? "success" : value.accent === "warning" ? "warning" : "primary",
      showLogo: value.showLogo !== false,
    };
  } catch {
    return defaultPresentSettings;
  }
}

export function readPresentSettings(): PresentSettings {
  try {
    return parsePresentSettings(localStorage.getItem(PRESENT_SETTINGS_KEY));
  } catch {
    return defaultPresentSettings;
  }
}

export function writePresentSettings(settings: PresentSettings): void {
  try {
    localStorage.setItem(PRESENT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage disabled (private mode): the screen still works for this session.
  }
}
