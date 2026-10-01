import { describe, expect, it } from "vitest";
import { checkUrl, isBlockedAddress, isBlockedIPv4, isBlockedIPv6, validateProfileUrl, type UrlRejection } from "@/lib/urls/safe-url";

function reasonOf(url: string, options?: { allowHttp?: boolean }): UrlRejection | "ok" {
  const result = checkUrl(url, options);
  return result.ok ? "ok" : result.reason;
}

describe("checkUrl: accepted URLs", () => {
  it.each([
    "https://example.com/a",
    "http://example.com",
    "https://sub.domain.example.co.uk/path?x=1",
    "https://example.com:443/x",
    "http://example.com:80/x",
    "HTTPS://EXAMPLE.COM/",
    "https://xn--80ak6aa92e.com/",
    "http://8.8.8.8/",
    "http://[2606:4700:4700::1111]/",
  ])("accepts the public URL %s", (url) => {
    expect(reasonOf(url)).toBe("ok");
  });

  it("returns the parsed URL", () => {
    const result = checkUrl("  https://caspian.example/team?id=1  ");
    expect(result.ok && result.url.hostname).toBe("caspian.example");
  });
});

describe("checkUrl: schemes", () => {
  it.each(["file:///etc/passwd", "javascript:alert(1)", "gopher://example.com/_x", "ftp://example.com/x", "data:text/html,hi", "ws://example.com/"])(
    "rejects %s",
    (url) => {
      expect(reasonOf(url)).toBe("scheme");
    },
  );

  it("rejects plain http when allowHttp is false", () => {
    expect(reasonOf("http://example.com", { allowHttp: false })).toBe("scheme");
    expect(reasonOf("https://example.com", { allowHttp: false })).toBe("ok");
  });
});

describe("checkUrl: credentials and ports", () => {
  it("rejects credentials in the URL", () => {
    expect(reasonOf("https://user:pass@example.com/")).toBe("credentials");
    expect(reasonOf("https://user@example.com/")).toBe("credentials");
  });

  it("rejects ports other than 80 and 443", () => {
    expect(reasonOf("https://example.com:8443/")).toBe("port");
    expect(reasonOf("http://example.com:22/")).toBe("port");
    expect(reasonOf("http://example.com:6379/")).toBe("port");
  });
});

describe("checkUrl: internal host names", () => {
  it.each([
    "http://localhost/",
    "http://LOCALHOST./",
    "http://api.localhost/",
    "http://printer.local/",
    "http://db.internal/",
    "http://intranet/",
    "http://router/",
    "http://metadata/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "https://kubernetes.default/",
    "https://something.home.arpa/",
    "https://files.corp/",
  ])("rejects %s", (url) => {
    expect(reasonOf(url)).toBe("internal_host");
  });
});

describe("checkUrl: IPv4 literals", () => {
  it.each([
    ["loopback", "http://127.0.0.1/"],
    ["loopback (short form)", "http://127.1/"],
    ["unspecified", "http://0.0.0.0/"],
    ["private 10/8", "http://10.0.0.1/"],
    ["private 172.16/12", "http://172.16.5.4/"],
    ["private 172.31", "http://172.31.255.255/"],
    ["private 192.168/16", "http://192.168.1.1/"],
    ["link-local / cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["CGNAT", "http://100.64.0.1/"],
    ["benchmarking", "http://198.18.0.1/"],
    ["multicast", "http://224.0.0.1/"],
    ["broadcast", "http://255.255.255.255/"],
  ])("rejects %s (%s)", (_label, url) => {
    expect(reasonOf(url)).toBe("private_address");
  });

  it("does not over-block neighbours of private ranges", () => {
    expect(reasonOf("http://172.32.0.1/")).toBe("ok");
    expect(reasonOf("http://100.128.0.1/")).toBe("ok");
  });
});

describe("checkUrl: alternative IPv4 encodings", () => {
  it.each([
    "http://2130706433/", // decimal 127.0.0.1
    "http://0x7f.1/", // hex + short form
    "http://0x7f000001/", // hex
    "http://017700000001/", // octal
    "http://0177.0.0.1/", // octal octet
    "http://0/", // 0.0.0.0
  ])("rejects %s", (url) => {
    expect(reasonOf(url)).toBe("private_address");
  });
});

describe("checkUrl: IPv6 literals", () => {
  it.each([
    ["loopback", "http://[::1]/"],
    ["unspecified", "http://[::]/"],
    ["IPv4-mapped loopback", "http://[::ffff:127.0.0.1]/"],
    ["IPv4-mapped loopback (hex)", "http://[::ffff:7f00:1]/"],
    ["IPv4-mapped metadata", "http://[::ffff:169.254.169.254]/"],
    ["unique local", "http://[fd00::1]/"],
    ["link-local", "http://[fe80::1]/"],
    ["documentation", "http://[2001:db8::1]/"],
    ["NAT64 of loopback", "http://[64:ff9b::7f00:1]/"],
    ["6to4 of loopback", "http://[2002:7f00:1::]/"],
  ])("rejects %s (%s)", (_label, url) => {
    expect(reasonOf(url)).toBe("private_address");
  });
});

describe("checkUrl: malformed input", () => {
  it("rejects unparseable and overly long URLs", () => {
    expect(reasonOf("not a url")).toBe("invalid");
    expect(reasonOf(`https://${"a".repeat(2100)}.com/`)).toBe("too_long");
  });

  it("does not treat a backslash trick as a different host", () => {
    const result = checkUrl("http://example.com\\@127.0.0.1/");
    expect(result.ok && result.url.hostname).toBe("example.com");
  });
});

describe("validateProfileUrl", () => {
  it("accepts public http(s) profile URLs", () => {
    expect(validateProfileUrl("https://linkedin.example/in/elnara-gasimova").ok).toBe(true);
    expect(validateProfileUrl("http://caspian.example/team/elnara").ok).toBe(true);
  });

  it("applies the same SSRF rules", () => {
    expect(validateProfileUrl("javascript:alert(document.cookie)")).toEqual({ ok: false, reason: "scheme" });
    expect(validateProfileUrl("http://169.254.169.254/")).toEqual({ ok: false, reason: "private_address" });
    expect(validateProfileUrl("https://admin:secret@caspian.example/")).toEqual({ ok: false, reason: "credentials" });
    expect(validateProfileUrl("http://localhost:3000/")).toMatchObject({ ok: false });
  });
});

describe("address helpers", () => {
  it("isBlockedIPv4 checks range boundaries", () => {
    expect(isBlockedIPv4("172.15.255.255")).toBe(false);
    expect(isBlockedIPv4("172.16.0.0")).toBe(true);
    expect(isBlockedIPv4("8.8.8.8")).toBe(false);
  });

  it("isBlockedIPv6 allows global unicast and blocks invalid input", () => {
    expect(isBlockedIPv6("2001:4860:4860::8888")).toBe(false);
    expect(isBlockedIPv6("::ffff:8.8.8.8")).toBe(false);
    expect(isBlockedIPv6("not-an-address")).toBe(true);
  });

  it("isBlockedAddress treats anything that is not an IP as blocked", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("10.1.1.1")).toBe(true);
    expect(isBlockedAddress("::1")).toBe(true);
    expect(isBlockedAddress("[::1]")).toBe(true);
    expect(isBlockedAddress("example.com")).toBe(true);
  });
});
