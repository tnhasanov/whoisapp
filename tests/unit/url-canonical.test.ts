import { describe, expect, it } from "vitest";
import { canonicaliseUrl, hostnameOf, publisherFromUrl, registrableDomain, sameSite } from "@/lib/urls/canonical";

describe("canonicaliseUrl", () => {
  it("removes tracking parameters (utm_*, fbclid, gclid, …) and sorts the rest", () => {
    expect(canonicaliseUrl("https://example.com/path?utm_source=x&b=2&a=1&fbclid=abc")).toBe("https://example.com/path?a=1&b=2");
    expect(canonicaliseUrl("https://example.com/news?UTM_MEDIUM=email&gclid=1&ref=home&id=7")).toBe("https://example.com/news?id=7");
  });

  it("drops the query string entirely when only tracking parameters were present", () => {
    expect(canonicaliseUrl("https://example.com/a?utm_campaign=x&utm_id=1&igshid=2")).toBe("https://example.com/a");
  });

  it("strips www. and m. prefixes and lower-cases the host", () => {
    expect(canonicaliseUrl("https://WWW.Example.com/a")).toBe("https://example.com/a");
    expect(canonicaliseUrl("https://m.example.com/a")).toBe("https://example.com/a");
  });

  it("removes the fragment, credentials and default ports, and normalises the scheme", () => {
    expect(canonicaliseUrl("http://user:pw@example.com:80/x#section-2")).toBe("https://example.com/x");
    expect(canonicaliseUrl("https://example.com:443/x")).toBe("https://example.com/x");
  });

  it("keeps non-default ports", () => {
    expect(canonicaliseUrl("https://example.com:8080/x")).toBe("https://example.com:8080/x");
  });

  it("removes trailing slashes and duplicate slashes", () => {
    expect(canonicaliseUrl("https://example.com/news/")).toBe("https://example.com/news");
    expect(canonicaliseUrl("https://example.com/a//b///")).toBe("https://example.com/a/b");
    expect(canonicaliseUrl("https://example.com/")).toBe("https://example.com");
    expect(canonicaliseUrl("https://example.com")).toBe("https://example.com");
  });

  it("removes a trailing dot from the host", () => {
    expect(canonicaliseUrl("https://example.com./x/")).toBe("https://example.com/x");
  });

  it("treats index documents as their directory", () => {
    expect(canonicaliseUrl("https://example.com/index.html")).toBe("https://example.com");
    expect(canonicaliseUrl("https://example.com/team/index.php")).toBe(canonicaliseUrl("https://example.com/team/"));
    expect(canonicaliseUrl("https://example.com/a//b/default.aspx")).toBe(canonicaliseUrl("https://example.com/a/b"));
  });

  it("gives the same key to equivalent URLs", () => {
    const variants = [
      "https://www.caspian.example/team/elnara/?utm_source=newsletter",
      "http://caspian.example/team/elnara#bio",
      "https://m.caspian.example/team/elnara?fbclid=xyz",
    ];
    expect(new Set(variants.map(canonicaliseUrl)).size).toBe(1);
  });

  it("returns unparseable input trimmed", () => {
    expect(canonicaliseUrl("  not a url ")).toBe("not a url");
  });
});

describe("hostnameOf", () => {
  it("returns the lower-cased host without www.", () => {
    expect(hostnameOf("https://WWW.Example.com/x")).toBe("example.com");
    expect(hostnameOf("nope")).toBeNull();
  });
});

describe("registrableDomain", () => {
  it("returns eTLD+1 for ordinary hosts", () => {
    expect(registrableDomain("https://a.b.example.com/x")).toBe("example.com");
    expect(registrableDomain("https://example.com")).toBe("example.com");
    expect(registrableDomain("sub.example.org")).toBe("example.org");
  });

  it("understands multi-part public suffixes", () => {
    expect(registrableDomain("https://news.bbc.co.uk/x")).toBe("bbc.co.uk");
    expect(registrableDomain("https://www.caspian.com.az/about")).toBe("caspian.com.az");
    expect(registrableDomain("https://portal.edu.az")).toBe("portal.edu.az");
  });

  it("returns IP literals as-is and null for empty input", () => {
    expect(registrableDomain("https://127.0.0.1/x")).toBe("127.0.0.1");
    expect(registrableDomain("https://[::1]/x")).toBe("[::1]");
    expect(registrableDomain("")).toBeNull();
  });
});

describe("publisherFromUrl", () => {
  it("falls back to the registrable domain", () => {
    expect(publisherFromUrl("https://news.baku-tech.example/a")).toBe("baku-tech.example");
  });
});

describe("sameSite", () => {
  it("compares registrable domains", () => {
    expect(sameSite("https://news.example.com/a", "https://www.example.com/b")).toBe(true);
    expect(sameSite("https://x.a.co.uk", "https://y.a.co.uk")).toBe(true);
    expect(sameSite("https://a.co.uk", "https://b.co.uk")).toBe(false);
    expect(sameSite("https://example.com", "https://example.org")).toBe(false);
    expect(sameSite("", "")).toBe(false);
  });
});
