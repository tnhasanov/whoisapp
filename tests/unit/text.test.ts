import { describe, expect, it } from "vitest";
import { clip, contactValueAppearsIn, digitsOnly, excerptAppearsIn, keyify, normaliseForMatch } from "@/lib/research/text";

describe("normaliseForMatch", () => {
  it("folds dotless and dotted I", () => {
    expect(normaliseForMatch("QASIMOVA Qasımova")).toBe("qasimova qasimova");
    expect(normaliseForMatch("İlkin")).toBe("ilkin");
  });

  it("normalises typographic quotes and dashes", () => {
    expect(normaliseForMatch("“Hello” ‘world’ «Caspian»")).toBe("\"hello\" 'world' \"caspian\"");
    expect(normaliseForMatch("2014 – 2016 — now ‐ here − there")).toBe("2014 - 2016 - now - here - there");
  });

  it("removes zero-width characters and soft hyphens", () => {
    expect(normaliseForMatch("ze​ro‍width﻿ soft­hyphen")).toBe("zerowidth softhyphen");
  });

  it("strips diacritics, expands the ellipsis and collapses whitespace", () => {
    expect(normaliseForMatch("  Café…\n\t  Ok  ")).toBe("cafe... ok");
  });
});

describe("excerptAppearsIn", () => {
  const text =
    "Elnara Gasimova is the Chief Executive Officer of Caspian Lantern Analytics. She joined the company in 2014 after working at Absheron Data Partners as a senior analyst.";

  it("finds a verbatim excerpt", () => {
    expect(excerptAppearsIn("Elnara Gasimova is the Chief Executive Officer", text)).toBe(true);
  });

  it("is case- and whitespace-insensitive and tolerates typographic noise", () => {
    expect(excerptAppearsIn("ELNARA   gasimova IS THE chief", text)).toBe(true);
    expect(excerptAppearsIn("Elnara Qasımova is", "ELNARA QASIMOVA IS here")).toBe(true);
    expect(excerptAppearsIn("Caspian — Lantern data", "Caspian - Lantern Data")).toBe(true);
  });

  it("accepts quoted excerpts", () => {
    expect(excerptAppearsIn('"Elnara Gasimova is the Chief Executive Officer"', text)).toBe(true);
  });

  it("accepts elided excerpts whose fragments appear in order", () => {
    expect(excerptAppearsIn("Elnara Gasimova is the Chief Executive Officer ... joined the company in 2014", text)).toBe(true);
    expect(excerptAppearsIn("Elnara Gasimova is the Chief Executive Officer … joined the company in 2014", text)).toBe(true);
  });

  it("rejects elided fragments that appear out of order", () => {
    expect(excerptAppearsIn("joined the company in 2014 ... Elnara Gasimova is the Chief", text)).toBe(false);
  });

  it("rejects short fragments", () => {
    // Fragments of an elided excerpt must be at least 12 characters.
    expect(excerptAppearsIn("Elnara Gasimova is the Chief Executive Officer ... in 2014", text)).toBe(false);
    expect(excerptAppearsIn("Elnara … 2014", text)).toBe(false);
    // A single fragment must be at least 6 characters.
    expect(excerptAppearsIn("Gasim", text)).toBe(false);
    expect(excerptAppearsIn("Gasimova", text)).toBe(true);
  });

  it("rejects paraphrases and empty excerpts", () => {
    expect(excerptAppearsIn("Elnara Gasimova is the CEO", text)).toBe(false);
    expect(excerptAppearsIn("", text)).toBe(false);
    expect(excerptAppearsIn("...", text)).toBe(false);
  });
});

describe("contactValueAppearsIn", () => {
  it("matches phone numbers by digits across formatting styles", () => {
    expect(contactValueAppearsIn("+994 12 555 01 23", "Reception: +994 (12) 555-01-23")).toBe(true);
    expect(contactValueAppearsIn("+994125550123", "Call +994 12 555 01 23 today")).toBe(true);
    expect(contactValueAppearsIn("+994 12 555 01 23", "Tel. +994.12.555.01.23")).toBe(true);
  });

  it("matches a number printed without its country code", () => {
    expect(contactValueAppearsIn("555 01 23", "Phone +994 12 555 01 23")).toBe(true);
  });

  it("rejects a different number", () => {
    expect(contactValueAppearsIn("+994 12 555 01 99", "Call +994 12 555 01 23 today")).toBe(false);
  });

  it("never lets a shorter fragment on the page confirm a longer value", () => {
    expect(contactValueAppearsIn("+994 50 312 34 56", "Ref. 12 34 56")).toBe(false);
    expect(contactValueAppearsIn("+44 20 7946 0358", "Ext. 7946 0358")).toBe(false);
  });

  it("matches national and international forms of the same number", () => {
    expect(contactValueAppearsIn("+994 12 555 01 23", "Office: (012) 555 01 23")).toBe(true);
    expect(contactValueAppearsIn("(012) 555 01 23", "Office: +994 12 555 01 23")).toBe(true);
    expect(contactValueAppearsIn("+44 20 7946 0358", "Call 020 7946 0358")).toBe(true);
    expect(contactValueAppearsIn("+7 495 123-45-67", "Тел.: 8 (495) 123-45-67")).toBe(true);
    expect(contactValueAppearsIn("+44 20 7946 0358", "Call 020 7946 0359")).toBe(false);
  });

  it("rejects values with too few digits", () => {
    expect(contactValueAppearsIn("12345", "12345")).toBe(false);
  });

  it("matches emails literally (case-insensitive) and rejects guessed ones", () => {
    expect(contactValueAppearsIn("info@caspian.example", "Email: INFO@Caspian.example")).toBe(true);
    expect(contactValueAppearsIn("elnara@caspian.example", "Email: info@caspian.example")).toBe(false);
  });

  it("matches URLs literally", () => {
    expect(contactValueAppearsIn("https://caspian.example/contact", "See https://caspian.example/contact for details")).toBe(true);
    expect(contactValueAppearsIn("https://caspian.example/team/elnara", "See https://caspian.example/contact")).toBe(false);
  });
});

describe("digitsOnly", () => {
  it("keeps digits only", () => {
    expect(digitsOnly("+994 (12) 555-01-23")).toBe("994125550123");
  });
});

describe("clip", () => {
  it("returns short text unchanged (whitespace collapsed)", () => {
    expect(clip("short", 10)).toBe("short");
    expect(clip("  a   b  ", 10)).toBe("a b");
  });

  it("cuts on a word boundary and marks the cut", () => {
    expect(clip("one two three four five six", 15)).toBe("one two three…");
  });

  it("cuts mid-word when no reasonable boundary exists", () => {
    expect(clip("abcdefghijklmnop", 5)).toBe("abcde…");
  });
});

describe("keyify", () => {
  it("builds stable slug-like keys", () => {
    expect(keyify("Caspian Lantern Analytics, LLC")).toBe("caspian-lantern-analytics-llc");
    expect(keyify("  --Hello--World--  ")).toBe("hello-world");
  });

  it("keeps non-Latin letters and folds dotless ı", () => {
    expect(keyify("Qasımova MMC")).toBe("qasimova-mmc");
    expect(keyify("Гасымова & Co.")).toBe("гасымова-co");
  });
});
