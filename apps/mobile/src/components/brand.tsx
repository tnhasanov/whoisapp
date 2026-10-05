import Svg, { Path, Rect } from "react-native-svg";
import { useColors } from "@/lib/theme";

/** The PersonBrief mark (same drawing as the website and the app icon). */
export function BrandMark({ size = 32 }: { size?: number }) {
  const colors = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no">
      <Rect x={1} y={1} width={30} height={30} rx={7} fill={colors.ink} />
      <Path d="M10.5 23V9h6.2c3 0 4.9 1.7 4.9 4.4s-1.9 4.4-4.9 4.4h-3.3V23z" fill={colors.canvas} />
      <Rect x={13.4} y={11.6} width={5.4} height={3.6} rx={1.2} fill={colors.accent} />
    </Svg>
  );
}
