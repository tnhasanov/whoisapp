import { Tabs } from "expo-router";
import { Activity, Bookmark, Search, Settings } from "lucide-react-native";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { FONTS, useColors } from "@/lib/theme";

const ICON = 22;
/**
 * The standard 49pt bar leaves about 11pt under its 28pt icon slot, too little
 * for the Inter label line (14), so the bar is a little taller. A custom height
 * must include the bottom safe-area inset.
 */
const BAR_HEIGHT = 54;

/** The four main areas. Each tab keeps its own scroll position; details open in the root stack. */
export default function TabsLayout() {
  const t = useTranslations("App.tabs");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: BAR_HEIGHT + insets.bottom },
        tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 11, lineHeight: 14 },
        tabBarHideOnKeyboard: Platform.OS === "android",
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarButtonTestID: "tab-search", title: t("search"), tabBarIcon: ({ color }) => <Search color={color} size={ICON} /> }} />
      <Tabs.Screen name="saved" options={{ tabBarButtonTestID: "tab-saved", title: t("saved"), tabBarIcon: ({ color }) => <Bookmark color={color} size={ICON} /> }} />
      <Tabs.Screen name="activity" options={{ tabBarButtonTestID: "tab-activity", title: t("activity"), tabBarIcon: ({ color }) => <Activity color={color} size={ICON} /> }} />
      <Tabs.Screen name="settings" options={{ tabBarButtonTestID: "tab-settings", title: t("settings"), tabBarIcon: ({ color }) => <Settings color={color} size={ICON} /> }} />
    </Tabs>
  );
}
