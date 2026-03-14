import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { ThemeConfig } from "../../../shared/themes";

interface SalonThemeContextValue {
  theme: ThemeConfig | null;
}

const SalonThemeContext = createContext<SalonThemeContextValue>({ theme: null });

export function useSalonTheme() {
  return useContext(SalonThemeContext);
}

/**
 * Applies dynamic theme CSS variables to the document root
 */
function applyThemeVariables(theme: ThemeConfig) {
  const root = document.documentElement;
  const style = root.style;

  // Map theme colors to CSS custom properties for dynamic theming
  style.setProperty("--salon-primary", theme.colors.primary);
  style.setProperty("--salon-primary-light", theme.colors.primaryLight);
  style.setProperty("--salon-primary-dark", theme.colors.primaryDark);
  style.setProperty("--salon-secondary", theme.colors.secondary);
  style.setProperty("--salon-accent", theme.colors.accent);
  style.setProperty("--salon-bg", theme.colors.background);
  style.setProperty("--salon-surface", theme.colors.surface);
  style.setProperty("--salon-surface-hover", theme.colors.surfaceHover);
  style.setProperty("--salon-text", theme.colors.text);
  style.setProperty("--salon-text-muted", theme.colors.textMuted);
  style.setProperty("--salon-border", theme.colors.border);
  style.setProperty("--salon-input-bg", theme.colors.inputBg);
  style.setProperty("--salon-input-border", theme.colors.inputBorder);
  style.setProperty("--salon-input-focus", theme.colors.inputFocus);
  style.setProperty("--salon-success", theme.colors.success);
  style.setProperty("--salon-error", theme.colors.error);
  style.setProperty("--salon-radius", theme.borderRadius);
  style.setProperty("--salon-shadow", theme.shadow);
  style.setProperty("--salon-font-heading", theme.fonts.heading);
  style.setProperty("--salon-font-body", theme.fonts.body);
}

export function SalonThemeProvider({
  theme,
  children,
}: {
  theme: ThemeConfig | null;
  children: ReactNode;
}) {
  useEffect(() => {
    if (theme) {
      applyThemeVariables(theme);
    }
  }, [theme]);

  return (
    <SalonThemeContext.Provider value={{ theme }}>
      {children}
    </SalonThemeContext.Provider>
  );
}
