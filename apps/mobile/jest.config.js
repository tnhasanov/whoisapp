// Two Jest projects:
//  - "app": component and unit tests (jest-expo, iOS preset) with native modules mocked.
//  - "api": the app's real auth client and API client against a running PersonBrief
//    server (set PB_TEST_API_URL, PB_TEST_EMAIL, PB_TEST_PASSWORD; skipped otherwise).
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");
const moduleNameMapper = {
  "^@/(.*)$": "<rootDir>/src/$1",
  "^@personbrief/shared/(.*)$": `${repoRoot}/packages/shared/src/$1`,
  "^@personbrief/messages/(.*)$": `${repoRoot}/messages/$1`,
  // Shared code imports zod from outside this folder; always use the app's copy.
  "^zod$": "<rootDir>/node_modules/zod",
  "\\.(ttf|png)$": "<rootDir>/test/file-stub.js",
};
const esmPackages = [
  "(jest-)?react-native",
  "@react-native(-community)?",
  "expo(nent)?",
  "@expo(nent)?/.*",
  "@expo-google-fonts/.*",
  "react-navigation",
  "standard-navigation",
  "native-base",
  "@sentry/react-native",
  "@react-navigation/.*",
  "better-auth",
  "@better-auth/.*",
  "@better-fetch/.*",
  "better-call",
  "nanostores",
  "use-intl",
  "icu-minify",
  "intl-messageformat",
  "@formatjs/.*",
  "@schummar/.*",
  "lucide-react-native",
  "@tanstack/.*",
  "react-native-svg",
  "jose",
  "uncrypto",
  "rou3",
  "defu",
];
// Prefix match (as in jest-expo's default): "expo" also covers expo-modules-core, expo-router, …
const transformIgnorePatterns = [`node_modules/(?!(${esmPackages.join("|")}))`];

module.exports = {
  projects: [
    {
      displayName: "app",
      preset: "jest-expo/ios",
      rootDir: __dirname,
      testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
      setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
      moduleNameMapper,
      transformIgnorePatterns,
      transform: { "\\.mjs$": "babel-jest" },
    },
    {
      displayName: "api",
      preset: "jest-expo/ios",
      rootDir: __dirname,
      testMatch: ["<rootDir>/test/api/**/*.test.ts"],
      setupFilesAfterEnv: ["<rootDir>/test/api/setup.ts"],
      moduleNameMapper,
      transformIgnorePatterns,
      transform: { "\\.mjs$": "babel-jest" },
    },
  ],
};
