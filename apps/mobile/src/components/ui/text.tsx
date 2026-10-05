import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import type { ColorToken } from "@personbrief/shared/design/tokens";
import { TYPE, useColors, type TypeVariant } from "@/lib/theme";

export type Tone = "ink" | "ink-2" | "muted" | "subtle" | "accent" | "accent-ink" | "on-accent" | "ok" | "warn" | "danger" | "demo" | "violet";

type Props = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  align?: TextStyle["textAlign"];
  weight?: TextStyle["fontFamily"];
  /** BCP 47 language of the text when it differs from the interface (source excerpts). */
  lang?: string | null;
};

/** Brand text: Inter for the interface, Source Serif for names and reading. Scales with the system text size. */
export function Text({ variant = "body", tone = "ink", align, weight, style, lang, ...rest }: Props) {
  const colors = useColors();
  return (
    <RNText
      {...rest}
      // Very large accessibility sizes are honoured, with a ceiling that keeps layouts usable.
      maxFontSizeMultiplier={rest.maxFontSizeMultiplier ?? 2}
      {...(lang ? { lang } : {})}
      style={[TYPE[variant], { color: colors[tone as ColorToken] }, align ? { textAlign: align } : null, weight ? { fontFamily: weight } : null, style]}
    />
  );
}
