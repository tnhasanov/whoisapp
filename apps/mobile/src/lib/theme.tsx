import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import { DARK, LIGHT, type Palette } from "@personbrief/shared/design/tokens";
import { deviceStorage, PREF } from "./storage";

/**
 * Brand theme for native views, mirroring the website: warm off-white
 * canvas, white surfaces, navy ink, cobalt actions, and a full dark theme.
 * The theme preference is per device (system by default).
 */

export type ThemePreference = "system" | "light" | "dark";

export const FONTS = {
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semibold: "Inter-SemiBold",
  bold: "Inter-Bold",
  serif: "SourceSerif4-Regular",
  serifSemibold: "SourceSerif4-SemiBold",
} as const;

/** Font files bundled with the app (shared with the website's PDF export). */
export const FONT_SOURCES = {
  [FONTS.regular]: require("../../../../assets/fonts/Inter_400Regular.ttf"),
  [FONTS.medium]: require("../../../../assets/fonts/Inter_500Medium.ttf"),
  [FONTS.semibold]: require("../../../../assets/fonts/Inter_600SemiBold.ttf"),
  [FONTS.bold]: require("../../../../assets/fonts/Inter_700Bold.ttf"),
  [FONTS.serif]: require("../../../../assets/fonts/SourceSerif4_400Regular.ttf"),
  [FONTS.serifSemibold]: require("../../../../assets/fonts/SourceSerif4_600SemiBold.ttf"),
};

/** Type scale (size / line height). Text scales with the system font size. */
export const TYPE = {
  display: { fontFamily: FONTS.serifSemibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  title: { fontFamily: FONTS.serifSemibold, fontSize: 23, lineHeight: 29, letterSpacing: -0.25 },
  heading: { fontFamily: FONTS.serifSemibold, fontSize: 19, lineHeight: 25, letterSpacing: -0.15 },
  headline: { fontFamily: FONTS.semibold, fontSize: 16.5, lineHeight: 22 },
  body: { fontFamily: FONTS.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: FONTS.medium, fontSize: 16, lineHeight: 23 },
  reading: { fontFamily: FONTS.serif, fontSize: 17, lineHeight: 26 },
  callout: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 21 },
  subhead: { fontFamily: FONTS.medium, fontSize: 14, lineHeight: 19 },
  footnote: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: FONTS.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: FONTS.semibold, fontSize: 11.5, lineHeight: 15, letterSpacing: 0.7, textTransform: "uppercase" as const },
} as const;
export type TypeVariant = keyof typeof TYPE;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
/** Minimum touch target (Apple HIG 44 pt, Material 48 dp). */
export const TOUCH = 48;

export type Theme = {
  scheme: "light" | "dark";
  colors: Palette;
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
  reduceMotion: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void deviceStorage.get(PREF.theme).then((value) => {
      if (value === "light" || value === "dark" || value === "system") setPreferenceState(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  const value = useMemo<Theme>(() => {
    const scheme = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
    return {
      scheme,
      colors: scheme === "dark" ? DARK : LIGHT,
      preference,
      reduceMotion,
      setPreference: (next) => {
        setPreferenceState(next);
        void deviceStorage.set(PREF.theme, next);
      },
    };
  }, [preference, system, reduceMotion]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside ThemeProvider");
  return theme;
}

export function useColors(): Palette {
  return useTheme().colors;
}
