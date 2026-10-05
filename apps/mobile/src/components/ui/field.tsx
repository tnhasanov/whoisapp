import { forwardRef, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { FONTS, RADIUS, SPACE, TOUCH, useColors } from "@/lib/theme";
import { Text } from "./text";

type Props = TextInputProps & { label: string; hint?: string | null; error?: string | null; optional?: string | null };

/** Labelled text field with hint and error text announced to screen readers. */
export const Field = forwardRef<TextInput, Props>(function Field({ label, hint, error, optional, style, multiline, ...rest }, ref) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="subhead" tone="ink" nativeID={`${label}-label`}>
          {label}
        </Text>
        {optional ? (
          <Text variant="caption" tone="subtle">
            {optional}
          </Text>
        ) : null}
      </View>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint ?? undefined}
        placeholderTextColor={colors.subtle}
        selectionColor={colors.accent}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        {...rest}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.focus : colors["line-strong"],
            borderWidth: focused || error ? 1.5 : 1,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.sm },
  input: {
    minHeight: TOUCH,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    // 16+ keeps iOS from zooming and stays readable.
    fontSize: 16.5,
    fontFamily: FONTS.regular,
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
});
