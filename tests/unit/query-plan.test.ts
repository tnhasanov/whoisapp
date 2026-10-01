import { describe, expect, it } from "vitest";
import { SOCIAL_PLATFORM_DOMAINS } from "@/lib/research/config";
import { buildQueryPlan } from "@/lib/research/pipeline/run";
import type { SubjectDescriptor } from "@/lib/research/providers/types";

const NOW = new Date("2026-10-01T09:00:00.000Z");

const SUBJECT: SubjectDescriptor = {
  displayName: "Elnara Gasimova",
  nativeName: "Elnarə Qasımova",
  nameVariants: ["Elnara Gasimova", "Elnarə Qasımova", "Эльнара Гасымова"],
  organisation: "Caspian Lantern Analytics",
  role: "Chief Executive Officer",
  location: "Baku",
  distinguishingFacts: [],
};

type Limits = Parameters<typeof buildQueryPlan>[1];

function limits(overrides: Partial<Limits> = {}): Limits {
  return { maxSearchQueries: 16, maxResultsPerQuery: 6, includeNews: true, newsWindowMonths: 60, ...overrides };
}

const plan = (subject: SubjectDescriptor = SUBJECT, overrides: Partial<Limits> = {}) => buildQueryPlan(subject, limits(overrides), NOW);

describe("buildQueryPlan", () => {
  it("covers every category, in English, Azerbaijani and Russian, within a generous budget", () => {
    const queries = plan();
    expect(queries.map((q) => [q.category, q.language, q.topic])).toEqual([
      ["career", "en", "general"],
      ["career", "az", "general"],
      ["career", "ru", "general"],
      ["contacts", "en", "general"],
      ["accounts", "en", "general"],
      ["connections", "en", "general"],
      ["news", "en", "news"],
      ["news", "az", "news"],
      ["news", "ru", "news"],
      ["news", "en", "general"],
    ]);
    expect(queries.every((q) => q.maxResults === 6)).toBe(true);
  });

  it("anchors every query on a quoted form of the subject's name", () => {
    const forms = SUBJECT.nameVariants.map((v) => `"${v}"`);
    for (const q of plan()) expect(forms.some((f) => q.query.includes(f)), q.query).toBe(true);
  });

  it("adds the organisation to English career, contact and news queries", () => {
    const queries = plan();
    const byLabel = Object.fromEntries(queries.map((q) => [q.label, q.query]));
    expect(byLabel["Career and biography"]).toBe('"Elnara Gasimova" "Caspian Lantern Analytics"');
    expect(byLabel["Published business contacts"]).toBe('"Elnara Gasimova" "Caspian Lantern Analytics" contact');
    expect(byLabel["News (English)"]).toBe('"Elnara Gasimova" OR "Caspian Lantern Analytics"');
  });

  it("uses the Azerbaijani and Russian spellings when they are known", () => {
    const queries = plan();
    expect(queries.filter((q) => q.language === "az").map((q) => q.query)).toEqual(['"Elnarə Qasımova"', '"Elnarə Qasımova"']);
    expect(queries.filter((q) => q.language === "ru").map((q) => q.query)).toEqual(['"Эльнара Гасымова"', '"Эльнара Гасымова"']);
  });

  it("falls back to Azerbaijani or Cyrillic native names", () => {
    const az = plan({ ...SUBJECT, nameVariants: ["Elnara Gasimova"], nativeName: "Elnarə Qasımova" });
    expect(az.some((q) => q.language === "az" && q.query === '"Elnarə Qasımova"')).toBe(true);
    const ru = plan({ ...SUBJECT, nameVariants: ["Elnara Gasimova"], nativeName: "Эльнара Гасымова" });
    expect(ru.some((q) => q.language === "ru" && q.query === '"Эльнара Гасымова"')).toBe(true);
  });

  it("skips Azerbaijani and Russian queries when no such spelling exists", () => {
    const queries = plan({ ...SUBJECT, displayName: "John Smith", nativeName: null, nameVariants: ["John Smith"], organisation: null });
    expect(queries.map((q) => q.language)).not.toContain("az");
    expect(queries.map((q) => q.language)).not.toContain("ru");
    expect(queries.find((q) => q.label === "Career and biography")?.query).toBe('"John Smith"');
  });

  it("has no news queries when news is turned off", () => {
    const queries = plan(SUBJECT, { includeNews: false });
    expect(queries.some((q) => q.category === "news")).toBe(false);
    expect(queries.some((q) => q.topic === "news")).toBe(false);
    expect(queries).toHaveLength(6);
  });

  it("limits news searches to the news window", () => {
    const news = plan(SUBJECT, { newsWindowMonths: 24 }).filter((q) => q.topic === "news");
    expect(news).toHaveLength(3);
    expect(news.every((q) => q.startDate === "2024-10-01")).toBe(true);
  });

  it("restricts the accounts search to social platform domains", () => {
    const queries = plan();
    const accounts = queries.filter((q) => q.category === "accounts");
    expect(accounts).toHaveLength(1);
    const socialDomains = new Set(Object.values(SOCIAL_PLATFORM_DOMAINS).flat());
    expect(accounts[0].includeDomains?.length).toBeGreaterThan(0);
    for (const domain of accounts[0].includeDomains ?? []) expect(socialDomains.has(domain), domain).toBe(true);
    expect(accounts[0].includeDomains).toEqual(expect.arrayContaining(["linkedin.com", "facebook.com", "instagram.com", "x.com", "github.com"]));
    expect(queries.filter((q) => q.includeDomains).map((q) => q.category)).toEqual(["accounts"]);
  });

  it("stays within the search budget, reserving three queries for discovery", () => {
    for (let maxSearchQueries = 4; maxSearchQueries <= 20; maxSearchQueries++) {
      for (const includeNews of [true, false]) {
        const queries = plan(SUBJECT, { maxSearchQueries, includeNews });
        expect(queries.length + 3, `maxSearchQueries=${maxSearchQueries}`).toBeLessThanOrEqual(maxSearchQueries);
        expect(queries.length).toBeGreaterThan(0);
      }
    }
  });

  it("spreads a tight budget across categories, career first", () => {
    expect(plan(SUBJECT, { maxSearchQueries: 4 }).map((q) => q.label)).toEqual(["Career and biography"]);
    expect(plan(SUBJECT, { maxSearchQueries: 8 }).map((q) => q.category)).toEqual(["career", "contacts", "accounts", "connections", "news"]);
    const seven = plan(SUBJECT, { maxSearchQueries: 10 });
    expect(seven).toHaveLength(7);
    expect(seven.map((q) => q.label)).toEqual([
      "Career and biography",
      "Career (Azerbaijani spelling)",
      "Published business contacts",
      "Public professional profiles",
      "Documented collaborators",
      "News (English)",
      "News (Azerbaijani)",
    ]);
  });
});
