// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  {
    // Node-run tooling configuration.
    files: ["jest.config.js"],
    languageOptions: { globals: { __dirname: "readonly", require: "readonly", module: "writable" } },
  },
  {
    // Jest mock factories must use require() and run before imports are evaluated.
    files: ["src/**/__tests__/**", "test/**"],
    rules: { "@typescript-eslint/no-require-imports": "off", "import/first": "off" },
  },
  {
    ignores: ["dist-web/*", ".bundle-check/*", ".expo/*", "node_modules/*", "coverage/*"],
  },
]);
