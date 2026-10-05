import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, DARK, LIGHT } from "@personbrief/shared/design/tokens";
import { profileUrlProblem, searchFieldErrors } from "@personbrief/shared/research/search-input";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SHARED = path.join(ROOT, "packages/shared/src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

describe("shared package", () => {
  it("only imports zod and its own modules (it is bundled into the phone app)", () => {
    const offenders: string[] = [];
    for (const file of files(SHARED).filter((f) => f.endsWith(".ts"))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        const spec = match[1];
        if (spec === "zod" || spec.startsWith("./") || spec.startsWith("../")) continue;
        offenders.push(`${path.relative(ROOT, file)} → ${spec}`);
      }
      if (/process\.env|require\(/.test(source)) offenders.push(`${path.relative(ROOT, file)} → process.env/require`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the brand colours identical to the website stylesheet", () => {
    const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
    const block = (selector: RegExp) => {
      const match = selector.exec(css);
      if (!match) throw new Error(`missing ${selector}`);
      const start = match.index + match[0].length;
      return css.slice(start, css.indexOf("}", start));
    };
    const read = (body: string) => Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
    const light = read(block(/:root\s*\{/));
    const dark = read(block(/\[data-theme="dark"\]\s*\{/));
    for (const token of COLOR_TOKENS) {
      expect(LIGHT[token], `light ${token}`).toBe(light[token]);
      expect(DARK[token], `dark ${token}`).toBe(dark[token]);
    }
  });

  it("validates the search form the same way on every client", () => {
    expect(searchFieldErrors({ fullName: "Elnara Gasimova" })).toBeNull();
    expect(searchFieldErrors({ fullName: " " })).toEqual({ fullName: "name_required" });
    expect(searchFieldErrors({ fullName: "12345" })).toEqual({ fullName: "name_required" });
    expect(searchFieldErrors({ fullName: "A".repeat(121) })).toEqual({ fullName: "too_long" });
    expect(searchFieldErrors({ fullName: "Ann Lee", profileUrl: "ftp://example.org/x" })).toEqual({ profileUrl: "url_scheme" });
    expect(searchFieldErrors({ fullName: "Ann Lee", profileUrl: "https://user:pw@example.org/x" })).toEqual({ profileUrl: "url_credentials" });
    expect(profileUrlProblem("example.org/in/ann")).toBeNull();
    expect(profileUrlProblem("")).toBeNull();
  });
});
