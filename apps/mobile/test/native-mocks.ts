/**
 * In-memory stand-ins for native modules (Keychain/Keystore, biometrics,
 * notifications, files…) so app code runs under Jest. Shared by the component
 * tests and the live-server API tests.
 */

export const mockSecureStore = new Map<string, string>();
export const secureStore = mockSecureStore;

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
  getItem: jest.fn((key: string) => mockSecureStore.get(key) ?? null),
  setItem: jest.fn((key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  ExecutionEnvironment: { Bare: "bare", Standalone: "standalone", StoreClient: "storeClient" },
  default: {
    executionEnvironment: "standalone",
    expoConfig: { name: "PersonBrief Dev", version: "1.0.0", scheme: process.env.PB_TEST_API_URL ? "personbrief" : "personbrief-dev", extra: { variant: "development" }, hostUri: "192.168.1.20:8081" },
    easConfig: null,
    platform: { scheme: "personbrief-dev" },
  },
}));

jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.0.0", nativeBuildVersion: "1" }));

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en", languageTag: "en-US" }],
  getCalendars: () => [{ timeZone: "Asia/Baku" }],
}));

jest.mock("expo-network", () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
}));

jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
  dismissAuthSession: jest.fn(),
  WebBrowserPresentationStyle: { PAGE_SHEET: "pageSheet" },
}));

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => [2]),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test-token-123456]" })),
  useLastNotificationResponse: jest.fn(() => null),
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
}));

jest.mock("expo-device", () => ({ isDevice: true }));

export const mockFileSystem = { downloads: [] as { url: string; headers: Record<string, string> }[], deleted: [] as string[], created: new Set<string>() };
export const fileSystem = mockFileSystem;

jest.mock("expo-file-system", () => {
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri)).join("/");
    }
    get name() {
      return this.uri.split("/").pop() ?? "";
    }
    get exists() {
      return mockFileSystem.created.has(this.uri);
    }
    create() {
      mockFileSystem.created.add(this.uri);
    }
    delete() {
      mockFileSystem.deleted.push(this.uri);
      for (const uri of [...mockFileSystem.created]) if (uri.startsWith(this.uri)) mockFileSystem.created.delete(uri);
    }
    list() {
      return [];
    }
  }
  class File {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    static async downloadFileAsync(url: string, dir: Directory, options: { headers: Record<string, string> }) {
      mockFileSystem.downloads.push({ url, headers: options.headers });
      return new File(`${dir.uri}/export.pdf`);
    }
  }
  return { Directory, File, Paths: { cache: { uri: "file:///cache" } } };
});

jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(async () => undefined), isLoaded: () => true }));
