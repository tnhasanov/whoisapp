import "../native-mocks";

// These tests talk to a real PersonBrief server. The React Native test
// environment replaces fetch with a stub, so use a real HTTP client instead.
const nodeFetch = require("node-fetch");
global.fetch = nodeFetch as unknown as typeof fetch;
global.Headers = nodeFetch.Headers;
global.Request = nodeFetch.Request;
global.Response = nodeFetch.Response;

jest.setTimeout(180_000);
