import { readFileSync } from "node:fs";
import path from "node:path";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";

type Messages = { [key: string]: string | Messages };

const load = (locale: string): Messages => JSON.parse(readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"));

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(full, value);
    else for (const [k, v] of flatten(value, full)) out.set(k, v);
  }
  return out;
}

/** ICU argument names used by a message ({name}, {count, plural, ...}), parsed with the ICU parser next-intl uses. */
function argumentsOf(message: string): string[] {
  const names = new Set<string>();
  const walk = (elements: MessageFormatElement[]) => {
    for (const el of elements) {
      if (el.type !== TYPE.literal && el.type !== TYPE.pound && "value" in el && typeof el.value === "string") names.add(el.value);
      if (el.type === TYPE.plural || el.type === TYPE.select) for (const option of Object.values(el.options)) walk(option.value);
      if (el.type === TYPE.tag) walk(el.children);
    }
  };
  walk(parse(message, { ignoreTag: false }));
  return [...names].sort();
}

const en = flatten(load("en"));

describe.each(["az", "ru"])("messages/%s.json", (locale) => {
  const other = flatten(load(locale));

  it("has exactly the same keys as English", () => {
    expect([...other.keys()].filter((k) => !en.has(k))).toEqual([]);
    expect([...en.keys()].filter((k) => !other.has(k))).toEqual([]);
  });

  it("uses the same ICU arguments as English", () => {
    const mismatched = [...en.entries()]
      .filter(([key, message]) => other.has(key) && argumentsOf(message).join() !== argumentsOf(other.get(key)!).join())
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it("parses as ICU and uses CLDR plural categories", () => {
    const categories = locale === "ru" ? ["few", "many", "one", "other"] : ["one", "other"];
    const problems: string[] = [];
    const check = (key: string, elements: MessageFormatElement[]) => {
      for (const el of elements) {
        if (el.type === TYPE.plural && el.pluralType === "cardinal") {
          const found = Object.keys(el.options).filter((k) => !k.startsWith("="));
          if (found.join() && !categories.every((c) => found.includes(c))) problems.push(`${key}: ${found.join("/")}`);
          for (const option of Object.values(el.options)) check(key, option.value);
        }
        if (el.type === TYPE.select) for (const option of Object.values(el.options)) check(key, option.value);
        if (el.type === TYPE.tag) check(key, el.children);
      }
    };
    for (const [key, message] of other) check(key, parse(message));
    expect(problems).toEqual([]);
  });

  it("has no empty messages", () => {
    expect([...other.entries()].filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });
});

describe("message keys", () => {
  it("contain no dots (next-intl reserves them for nesting)", () => {
    const bad: string[] = [];
    const walk = (m: Messages, prefix: string) => {
      for (const [k, v] of Object.entries(m)) {
        if (k.includes(".")) bad.push(`${prefix}${k}`);
        if (typeof v !== "string") walk(v, `${prefix}${k}/`);
      }
    };
    walk(load("en"), "");
    expect(bad).toEqual([]);
  });
});
