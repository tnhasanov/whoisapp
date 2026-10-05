import "./native-mocks";

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// Component tests never touch the network: each test installs its own fetch.
beforeEach(() => {
  global.fetch = jest.fn(async () => {
    throw new TypeError("Network request failed (no fetch handler in this test)");
  }) as unknown as typeof fetch;
});
