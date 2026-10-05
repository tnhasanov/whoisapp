import { Tabs } from "expo-router";
import { Activity, Bookmark, Search, Settings } from "lucide-react-native";
import { Platform } from "react-native";
import { useTranslations } from "use-intl";
import { FONTS, useColors } from "@/lib/theme";

/** The four main areas. Each tab keeps its own scroll position; details open in the root stack. */
export default function TabsLayout() {
  const t = useTranslations("App.tabs");
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 11.5 },
        tabBarHideOnKeyboard: Platform.OS === "android",
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("search"), tabBarIcon: ({ color, size }) => <Search color={color} size={size - 2} /> }} />
      <Tabs.Screen name="saved" options={{ title: t("saved"), tabBarIcon: ({ color, size }) => <Bookmark color={color} size={size - 2} /> }} />
      <Tabs.Screen name="activity" options={{ title: t("activity"), tabBarIcon: ({ color, size }) => <Activity color={color} size={size - 2} /> }} />
      <Tabs.Screen name="settings" options={{ title: t("settings"), tabBarIcon: ({ color, size }) => <Settings color={color} size={size - 2} /> }} />
    </Tabs>
  );
}
