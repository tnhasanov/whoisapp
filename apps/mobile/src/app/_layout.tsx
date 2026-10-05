import "@/lib/polyfills";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { AccountSync } from "@/components/account-sync";
import { AppLockOverlay, PrivacyCover } from "@/components/app-lock-overlay";
import { LinkRouter } from "@/components/link-router";
import { SystemScreen } from "@/components/system-screen";
import { AppLockProvider } from "@/lib/app-lock";
import { deleteTemporaryExports } from "@/lib/exports";
import { I18nProvider } from "@/lib/i18n";
import { configureNotificationPresentation } from "@/lib/notifications";
import { createQueryClient, wireAppLifecycle } from "@/lib/query-client";
import { SessionProvider, useSession } from "@/lib/session";
import { FONT_SOURCES, FONTS, ThemeProvider, useTheme } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotificationPresentation();
wireAppLifecycle();
// Exports left over from a previous run (for example after a crash) are removed at launch.
void deleteTemporaryExports();
const queryClient = createQueryClient();

export const unstable_settings = { initialRouteName: "(tabs)" };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <I18nProvider>
              <SessionProvider>
                <RootNavigator ready={fontsLoaded || Boolean(fontError)} />
              </SessionProvider>
            </I18nProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ ready }: { ready: boolean }) {
  const { state, retry, signOut } = useSession();
  const { colors, scheme } = useTheme();
  const t = useTranslations("App");
  const booting = !ready || state.status === "booting";

  useEffect(() => {
    if (!booting) void SplashScreen.hideAsync().catch(() => undefined);
  }, [booting]);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.canvas).catch(() => undefined);
  }, [colors.canvas]);

  if (booting) return null;
  if (state.status === "misconfigured") return <SystemScreen kind="misconfigured" />;
  if (state.status === "upgradeRequired") return <SystemScreen kind="upgrade" />;
  if (state.status === "unreachable") return <SystemScreen kind="unreachable" onRetry={retry} onSignOut={() => void signOut()} />;

  const signedIn = state.status === "signedIn";
  return (
    <AppLockProvider active={signedIn}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerTintColor: colors.accent,
          headerStyle: { backgroundColor: colors.canvas },
          headerTitleStyle: { fontFamily: FONTS.semibold, color: colors.ink, fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t("tabs.search") }} />
          <Stack.Screen name="research/[jobId]" options={{ title: t("titles.research") }} />
          <Stack.Screen name="profile/[profileId]/index" options={{ title: t("titles.brief") }} />
          <Stack.Screen name="profile/[profileId]/notes" options={{ title: t("titles.notes") }} />
          <Stack.Screen name="profile/[profileId]/changes" options={{ title: t("titles.changes") }} />
          <Stack.Screen name="profile/[profileId]/report" options={{ title: t("titles.report"), presentation: "modal" }} />
          <Stack.Screen
            name="evidence"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.7, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 22,
              headerShown: false,
              contentStyle: { backgroundColor: colors.surface },
            }}
          />
          <Stack.Screen name="source/[key]" options={{ title: t("titles.fictionalSource") }} />
          <Stack.Screen name="sessions" options={{ title: t("titles.sessions") }} />
          <Stack.Screen name="data-use" options={{ title: t("titles.dataUse") }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="+not-found" options={{ title: t("titles.notFound") }} />
      </Stack>
      {signedIn ? <AccountSync /> : null}
      <LinkRouter signedIn={signedIn} />
      <AppLockOverlay />
      <PrivacyCover />
    </AppLockProvider>
  );
}
