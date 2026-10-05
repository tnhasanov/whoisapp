import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "@formatjs/icu-messageformat-parser";
import az from "../i18n/az.json";
import en from "../i18n/en.json";
import ru from "../i18n/ru.json";
import { MESSAGES } from "../lib/i18n";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [[`${prefix}${k}`, v]] : Object.entries(leaves(v, `${prefix}${k}.`)))),
  );
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : files(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("app message catalogues", () => {
  const catalogues = { en: leaves(en as Tree), az: leaves(az as Tree), ru: leaves(ru as Tree) };

  it("have the same keys in English, Azerbaijani and Russian", () => {
    const keys = Object.keys(catalogues.en).sort();
    expect(Object.keys(catalogues.az).sort()).toEqual(keys);
    expect(Object.keys(catalogues.ru).sort()).toEqual(keys);
  });

  it("are valid ICU messages with the same placeholders in every language", () => {
    const args = (message: string) =>
      JSON.stringify(
        parse(message)
          .filter((el) => "value" in el && el.type !== 0)
          .map((el) => (el as { value: string }).value)
          .sort(),
      );
    for (const [key, message] of Object.entries(catalogues.en)) {
      expect(() => parse(catalogues.az[key])).not.toThrow();
      expect(() => parse(catalogues.ru[key])).not.toThrow();
      expect(args(catalogues.az[key])).toBe(args(message));
      expect(args(catalogues.ru[key])).toBe(args(message));
    }
  });

  it("defines every App.* key the screens use", () => {
    const missing: string[] = [];
    for (const file of files(path.join(__dirname, ".."))) {
      const source = readFileSync(file, "utf8");
      // A variable name can be bound to different namespaces in different functions of a file.
      const vars = new Map<string, Set<string>>();
      for (const m of source.matchAll(/const (\w+) = useTranslations\("([\w.]+)"\)/g)) {
        if (!vars.has(m[1])) vars.set(m[1], new Set());
        vars.get(m[1])!.add(m[2]);
      }
      for (const [name, namespaces] of vars) {
        const appNamespaces = [...namespaces].filter((ns) => ns === "App" || ns.startsWith("App."));
        if (appNamespaces.length === 0 || appNamespaces.length !== namespaces.size) continue;
        for (const m of source.matchAll(new RegExp(`\\b${name}\\("([\\w.]+)"`, "g"))) {
          const candidates = appNamespaces.map((ns) => [ns.replace(/^App\.?/, ""), m[1]].filter(Boolean).join("."));
          if (!candidates.some((key) => key in catalogues.en)) missing.push(`${path.basename(file)}: ${appNamespaces.join("|")}.${m[1]}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("merges the website catalogues without website-only namespaces", () => {
    for (const locale of ["en", "az", "ru"] as const) {
      expect(MESSAGES[locale]).toHaveProperty("Evidence");
      expect(MESSAGES[locale]).toHaveProperty("App.tabs.search");
      expect(MESSAGES[locale]).not.toHaveProperty("Setup");
      expect(MESSAGES[locale]).not.toHaveProperty("Pdf");
    }
  });
});
