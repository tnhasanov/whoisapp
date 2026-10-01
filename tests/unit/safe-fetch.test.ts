import type { LookupAddress } from "node:dns";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { htmlToText, safeFetchText, SafeFetchError } from "@/lib/urls/safe-fetch";

/** Runs safeFetchText and returns the SafeFetchError reason it was refused with. */
async function refusal(url: string, resolver?: (hostname: string) => Promise<LookupAddress[]>): Promise<string> {
  try {
    await safeFetchText(url, { resolver, timeoutMs: 5_000 });
  } catch (error) {
    expect(error).toBeInstanceOf(SafeFetchError);
    return (error as SafeFetchError).reason;
  }
  throw new Error(`Expected ${url} to be refused`);
}

const answers =
  (...addresses: LookupAddress[]) =>
  async () =>
    addresses;

describe("safeFetchText: DNS answers are checked at connect time", () => {
  it("refuses a public-looking host that resolves to loopback", async () => {
    const resolver = vi.fn(answers({ address: "127.0.0.1", family: 4 }));
    expect(await refusal("http://rebind.example/", resolver)).toBe("blocked_address");
    expect(resolver).toHaveBeenCalledWith("rebind.example");
  });

  it("refuses cloud metadata and private answers", async () => {
    expect(await refusal("https://rebind.example/", answers({ address: "169.254.169.254", family: 4 }))).toBe("blocked_address");
    expect(await refusal("http://rebind.example/", answers({ address: "10.0.0.7", family: 4 }))).toBe("blocked_address");
    expect(await refusal("http://rebind.example/", answers({ address: "::1", family: 6 }))).toBe("blocked_address");
    expect(await refusal("http://rebind.example/", answers({ address: "::ffff:192.168.0.10", family: 6 }))).toBe("blocked_address");
  });

  it("refuses mixed public + private answers (a rebinding tell)", async () => {
    const resolver = answers({ address: "93.184.216.34", family: 4 }, { address: "10.0.0.7", family: 4 });
    expect(await refusal("http://rebind.example/", resolver)).toBe("blocked_address");
    const v6 = answers({ address: "2606:4700:4700::1111", family: 6 }, { address: "fd00::5", family: 6 });
    expect(await refusal("http://rebind.example/", v6)).toBe("blocked_address");
  });

  it("refuses an empty answer set", async () => {
    expect(await refusal("http://rebind.example/", answers())).toBe("blocked_address");
  });

  it("reports DNS failures as dns errors", async () => {
    const resolver = async () => {
      throw new Error("getaddrinfo ENOTFOUND rebind.example");
    };
    expect(await refusal("http://rebind.example/", resolver)).toBe("dns");
  });
});

describe("safeFetchText: unsafe URLs are rejected before any request", () => {
  it.each([
    ["file:///etc/passwd", "scheme"],
    ["javascript:alert(1)", "scheme"],
    ["gopher://example.com/_GET", "scheme"],
    ["https://user:pw@example.com/", "credentials"],
    ["https://example.com:8443/", "port"],
    ["http://localhost/", "internal_host"],
    ["http://metadata.google.internal/", "internal_host"],
    ["http://169.254.169.254/latest/meta-data/", "private_address"],
    ["http://2130706433/", "private_address"],
    ["http://0x7f.1/", "private_address"],
    ["http://[::ffff:127.0.0.1]/", "private_address"],
  ])("%s → %s, without resolving the host", async (url, reason) => {
    const resolver = vi.fn(answers({ address: "93.184.216.34", family: 4 }));
    expect(await refusal(url, resolver)).toBe(reason);
    expect(resolver).not.toHaveBeenCalled();
  });
});

describe("safeFetchText: a real server on 127.0.0.1 is never reached", () => {
  let server: http.Server;
  let port = 0;
  let hits = 0;

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      hits++;
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<p>internal secret</p>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("refuses direct, localhost and DNS-rebinding routes to it", async () => {
    expect(await refusal(`http://127.0.0.1:${port}/`)).toBe("port");
    expect(await refusal(`http://localhost:${port}/`)).toBe("port");
    expect(await refusal(`http://127.0.0.1/`)).toBe("private_address");
    // A hostname that resolves to the server's address is refused by the pinned lookup
    // (not by a failed connection), so nothing is ever sent.
    expect(await refusal("http://internal-service.example/", answers({ address: "127.0.0.1", family: 4 }))).toBe("blocked_address");
    expect(hits).toBe(0);
  });
});

describe("htmlToText", () => {
  it("drops scripts, styles, comments and other non-content elements", () => {
    const html = `<html><head><style>body{color:red}</style><script>alert("x")</script></head>
      <body><!-- hidden comment --><noscript>enable js</noscript><SCRIPT type="text/x">steal()</SCRIPT>
      <template><p>tpl</p></template><svg><text>icon</text></svg><p>Visible text</p></body></html>`;
    const text = htmlToText(html);
    expect(text).toBe("Visible text");
  });

  it("decodes common entities", () => {
    expect(htmlToText("<p>Caf&#233; &amp; Co &lt;b&gt; &quot;q&quot; &#39;s&#39; &apos;t&apos;&nbsp;end</p>")).toBe(`Café & Co <b> "q" 's' 't' end`);
  });

  it("decodes each entity once (no double decoding)", () => {
    expect(htmlToText("&amp;lt;script&amp;gt;")).toBe("&lt;script&gt;");
    expect(htmlToText("<p>It&#x27;s &#X41;&#x2014;ok</p>")).toBe("It's A—ok");
    expect(htmlToText("AT&amp;amp;T")).toBe("AT&amp;T");
  });

  it("replaces control-character and out-of-range numeric entities with spaces", () => {
    expect(htmlToText("a&#0;b&#1114112;c")).toBe("a b c");
  });

  it("turns block elements into line breaks and collapses whitespace", () => {
    const text = htmlToText("<h1>Title</h1><p>One   two</p><div>Line<br>break</div>");
    expect(text.split("\n").map((l) => l.trim())).toEqual(["Title", "One two", "Line", "break"]);
    expect(htmlToText("<p>a</p>\n\n\n\n<p>b</p>")).not.toMatch(/\n\s*\n\s*\n/);
  });
});
