import { describe, expect, it } from "vitest";
import type { EvidenceStatus, PartialDate, Temporal } from "@/lib/domain/types";
import {
  claimKeyForFact,
  degreeLevel,
  evidenceStatusFor,
  independentSourceCount,
  mergeFacts,
  normaliseTitle,
  organisationKey,
  pickHeadlineRole,
  reliabilityFor,
  temporalFor,
  type FactWithSource,
  type HeadlineCandidate,
  type MergedClaim,
} from "@/lib/evidence";
import type { ExtractedFact } from "@/lib/research/schemas";

const RESEARCHED_AT = new Date("2026-10-01T09:00:00Z");

function fact(overrides: Partial<ExtractedFact> = {}): ExtractedFact {
  return {
    source_id: "S1",
    category: "employment",
    organisation: "Caspian Lantern Analytics",
    title: "Chief Executive Officer",
    department: null,
    institution: null,
    qualification: null,
    field: null,
    place: null,
    place_scope: null,
    statement: null,
    award_name: null,
    issuer: null,
    publication_title: null,
    venue: null,
    start: null,
    end: null,
    approximate: false,
    currency: "unknown",
    supporting_excerpt: "Elnara Gasimova is the Chief Executive Officer",
    english_rendering: null,
    ...overrides,
  };
}

function member(sourceId: string, factOverrides: Partial<ExtractedFact> = {}, overrides: Partial<FactWithSource> = {}): FactWithSource {
  return {
    fact: fact({ source_id: sourceId, ...factOverrides }),
    sourceId,
    sourceDomain: `${sourceId.toLowerCase()}.example`,
    syndicationGroup: null,
    sourceReliability: "other_media",
    sourceAccess: "read",
    sourcePublishedAt: null,
    sourceAccessedAt: "2026-10-01T08:00:00Z",
    ...overrides,
  };
}

function claim(members: FactWithSource[], dates: { start?: PartialDate | null; end?: PartialDate | null } = {}): MergedClaim {
  return { claimKey: "k", category: "employment", members, conflictGroup: null, start: dates.start ?? null, end: dates.end ?? null };
}

describe("reliabilityFor", () => {
  it("is about the publisher type", () => {
    expect(reliabilityFor("official_bio", false)).toBe("official");
    expect(reliabilityFor("company_site", false)).toBe("official");
    expect(reliabilityFor("registry", false)).toBe("official");
    expect(reliabilityFor("press_release", false)).toBe("official");
    expect(reliabilityFor("news", false)).toBe("other_media");
    expect(reliabilityFor("interview", false)).toBe("other_media");
    expect(reliabilityFor("conference", false)).toBe("other_media");
    expect(reliabilityFor("social_profile", false)).toBe("social_platform");
    expect(reliabilityFor("search_listing", false)).toBe("aggregator");
    expect(reliabilityFor("other", false)).toBe("unknown");
  });

  it("treats personal sites and self-published pages as self-published", () => {
    expect(reliabilityFor("personal_site", false)).toBe("self_published");
    expect(reliabilityFor("news", true)).toBe("self_published");
    expect(reliabilityFor("official_bio", true)).toBe("self_published");
  });
});

describe("normaliseTitle", () => {
  it("expands abbreviations so CEO equals Chief Executive Officer", () => {
    expect(normaliseTitle("CEO")).toBe("chief executive officer");
    expect(normaliseTitle("Chief Executive Officer")).toBe("chief executive officer");
    expect(normaliseTitle("Chief Executive")).toBe("chief executive officer");
    expect(normaliseTitle("VP, Engineering")).toBe("vice president engineering");
    expect(normaliseTitle("Sr. Data Scientist")).toBe("senior data scientist");
    expect(normaliseTitle("MD")).toBe("managing director");
  });

  it("drops founder qualifiers around the main role", () => {
    expect(normaliseTitle("Co-founder & CEO")).toBe("chief executive officer");
    expect(normaliseTitle("Founder and CEO")).toBe("chief executive officer");
    expect(normaliseTitle("CEO and Co-Founder")).toBe("chief executive officer");
    expect(normaliseTitle("CTO / co-founder")).toBe("chief technology officer");
  });

  it("keeps a founder-only title and handles empty input", () => {
    expect(normaliseTitle("Co-founder")).toBe("co-founder");
    expect(normaliseTitle(null)).toBe("");
    expect(normaliseTitle("")).toBe("");
  });
});

describe("organisationKey", () => {
  it("strips legal suffixes so the same company compares equal", () => {
    const key = organisationKey("Caspian Lantern Analytics");
    expect(key).toBe("caspian-lantern-analytics");
    for (const name of [
      "Caspian Lantern Analytics MMC",
      "Caspian Lantern Analytics LLC",
      "Caspian Lantern Analytics, Ltd.",
      "Caspian Lantern Analytics Inc.",
      "«Caspian Lantern Analytics» ООО",
      "ООО «Caspian Lantern Analytics»",
      "Caspian Lantern Analytics ОАО",
    ]) {
      expect(organisationKey(name), name).toBe(key);
    }
  });

  it("does not strip suffix letters inside a word", () => {
    expect(organisationKey("Bakıco Trading")).toBe("bakico-trading");
    expect(organisationKey("Agroservis")).toBe("agroservis");
  });

  it("returns an empty key for missing names", () => {
    expect(organisationKey(null)).toBe("");
    expect(organisationKey(undefined)).toBe("");
  });
});

describe("degreeLevel", () => {
  it("maps equivalent qualifications to one level", () => {
    expect(degreeLevel("MSc Data Science")).toBe("master");
    expect(degreeLevel("Master of Science in Data Science")).toBe("master");
    expect(degreeLevel("MBA")).toBe("master");
    expect(degreeLevel("MA in History")).toBe("master");
    expect(degreeLevel("Magistr")).toBe("master");
    expect(degreeLevel("Магистр")).toBe("master");
    expect(degreeLevel("PhD")).toBe("doctorate");
    expect(degreeLevel("Ph.D.")).toBe("doctorate");
    expect(degreeLevel("Doctor of Philosophy")).toBe("doctorate");
    expect(degreeLevel("BA")).toBe("bachelor");
    expect(degreeLevel("B.Sc.")).toBe("bachelor");
    expect(degreeLevel("Bachelor of Arts")).toBe("bachelor");
    expect(degreeLevel("LLB")).toBe("bachelor");
    expect(degreeLevel("Certificate")).toBe("diploma");
  });

  it("does not mistake words ending in -ma/-ba for MA/BA", () => {
    expect(degreeLevel("Diploma in Management")).toBe("diploma");
    expect(degreeLevel("Diploma")).toBe("diploma");
    expect(degreeLevel("Certificate in Cinema Studies")).toBe("diploma");
  });

  it("falls back to a key or 'unspecified'", () => {
    expect(degreeLevel("Executive Programme")).toBe("executive-programme");
    expect(degreeLevel(null)).toBe("unspecified");
  });
});

describe("claimKeyForFact", () => {
  it("gives the same key to the same role written differently", () => {
    const a = claimKeyForFact(fact({ organisation: "Caspian Lantern Analytics MMC", title: "CEO" }));
    const b = claimKeyForFact(fact({ organisation: "Caspian Lantern Analytics LLC", title: "Chief Executive Officer" }));
    const c = claimKeyForFact(fact({ title: "İcraçı direktor", english_rendering: "Co-founder & CEO" }));
    expect(a).toBe("employment|caspian-lantern-analytics|chief-executive-officer");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("separates different roles at the same organisation", () => {
    expect(claimKeyForFact(fact({ title: "CTO" }))).not.toBe(claimKeyForFact(fact({ title: "CEO" })));
  });

  it("keys education by institution and degree level", () => {
    const a = claimKeyForFact(fact({ category: "education", organisation: null, title: null, institution: "ADA University", qualification: "MSc Data Science" }));
    const b = claimKeyForFact(
      fact({ category: "education", organisation: null, title: null, institution: "ADA University", qualification: "Master of Science in Data Science" }),
    );
    expect(a).toBe("education|ada-university|master");
    expect(b).toBe(a);
  });

  it("keys other categories by their main value", () => {
    expect(claimKeyForFact(fact({ category: "location", place: "Baku, Azerbaijan" }))).toBe("location|baku-azerbaijan");
    expect(claimKeyForFact(fact({ category: "award", award_name: "Best Startup 2020" }))).toBe("award|best-startup-2020");
    expect(claimKeyForFact(fact({ category: "publication", publication_title: "On Data" }))).toBe("publication|on-data");
    expect(claimKeyForFact(fact({ category: "biography", statement: "x".repeat(200) }))).toHaveLength("biography|".length + 80);
  });
});

describe("mergeFacts", () => {
  it("merges the same role with compatible dates and keeps the most precise date", () => {
    const merged = mergeFacts([member("A", { start: "2014" }), member("B", { start: "2014-06", title: "CEO" }), member("C")]);
    expect(merged).toHaveLength(1);
    expect(merged[0].claimKey).toBe("employment|caspian-lantern-analytics|chief-executive-officer");
    expect(merged[0].conflictGroup).toBeNull();
    expect(merged[0].members.map((m) => m.sourceId)).toEqual(["A", "B", "C"]);
    expect(merged[0].start).toMatchObject({ year: 2014, month: 6 });
  });

  it("keeps incompatible start dates as separate claims in one conflict group", () => {
    const merged = mergeFacts([member("A", { start: "2014" }), member("B", { start: "2015" })]);
    expect(merged).toHaveLength(2);
    expect(merged[0].conflictGroup).toBe("conflict:employment|caspian-lantern-analytics|chief-executive-officer");
    expect(merged[1].conflictGroup).toBe(merged[0].conflictGroup);
    expect(merged.map((m) => m.start?.year).sort()).toEqual([2014, 2015]);
    expect(new Set(merged.map((m) => m.claimKey)).size).toBe(2);
  });

  it("attaches undated mentions to the best-supported cluster", () => {
    const merged = mergeFacts([member("A", { start: "2014" }), member("B", { start: "2015" }), member("C"), member("D", { start: "2015-03" })]);
    const of2015 = merged.find((m) => m.start?.year === 2015)!;
    const of2014 = merged.find((m) => m.start?.year === 2014)!;
    expect(of2015.members.map((m) => m.sourceId).sort()).toEqual(["B", "C", "D"]);
    expect(of2014.members.map((m) => m.sourceId)).toEqual(["A"]);
  });

  it("merges undated mentions into one claim", () => {
    const merged = mergeFacts([member("A"), member("B")]);
    expect(merged).toHaveLength(1);
    expect(merged[0].start).toBeNull();
    expect(merged[0].members).toHaveLength(2);
  });

  it("keeps approximate start dates marked", () => {
    const [merged] = mergeFacts([member("A", { start: "2015", approximate: true })]);
    expect(merged.start).toMatchObject({ year: 2015, approximate: true });
  });

  it("does not merge different roles", () => {
    expect(mergeFacts([member("A", { title: "CEO" }), member("B", { title: "CTO" })])).toHaveLength(2);
  });
});

describe("independentSourceCount", () => {
  it("counts distinct publishers", () => {
    expect(independentSourceCount([member("A"), member("B")])).toBe(2);
    expect(independentSourceCount([member("A", {}, { sourceDomain: "news.example" }), member("B", {}, { sourceDomain: "news.example" })])).toBe(1);
  });

  it("counts syndicated copies once", () => {
    expect(independentSourceCount([member("A", {}, { syndicationGroup: "syn:A" }), member("B", {}, { syndicationGroup: "syn:A" })])).toBe(1);
  });

  it("falls back to the source id when the domain is unknown", () => {
    expect(independentSourceCount([member("A", {}, { sourceDomain: null }), member("B", {}, { sourceDomain: null })])).toBe(2);
  });
});

describe("evidenceStatusFor", () => {
  const status = (members: FactWithSource[], conflictGroup: string | null = null): EvidenceStatus => evidenceStatusFor({ members, conflictGroup });

  it("reports conflicts first", () => {
    expect(status([member("A"), member("B")], "conflict:x")).toBe("conflicting");
  });

  it("needs two independent publishers for multiple_sources", () => {
    expect(status([member("A"), member("B")])).toBe("multiple_sources");
    expect(status([member("A", {}, { sourceDomain: "same.example" }), member("B", {}, { sourceDomain: "same.example" })])).toBe("single_source");
    expect(status([member("A", {}, { syndicationGroup: "syn:A" }), member("B", {}, { syndicationGroup: "syn:A" })])).toBe("single_source");
  });

  it("uses the publisher type for single-publisher claims", () => {
    expect(status([member("A", {}, { sourceReliability: "official" })])).toBe("official_source");
    expect(status([member("A", {}, { sourceReliability: "self_published" })])).toBe("self_reported");
    expect(status([member("A", {}, { sourceReliability: "other_media" })])).toBe("single_source");
  });

  it("is snippet_only when no supporting page was read in full", () => {
    expect(status([member("A", {}, { sourceAccess: "snippet_only" }), member("B", {}, { sourceAccess: "paywalled" })])).toBe("snippet_only");
    expect(status([member("A", {}, { sourceAccess: "snippet_only" }), member("B")])).toBe("multiple_sources");
  });
});

describe("temporalFor", () => {
  it("flags a 'current' statement from a source older than 18 months", () => {
    const { temporal, uncertaintyNote } = temporalFor(claim([member("A", { currency: "stated_current" }, { sourcePublishedAt: "2023-05-01" })]), RESEARCHED_AT);
    expect(temporal).toEqual({ start: null, end: null, currency: "stated_current", asOf: "2023-05-01", asOfBasis: "published", possiblyOutdated: true });
    expect(uncertaintyNote).toContain("2023-05-01");
    expect(uncertaintyNote).toMatch(/may no longer be accurate/);
  });

  it("marks a currency date taken from an undated page as an access date", () => {
    const { temporal } = temporalFor(
      claim([member("A", { currency: "stated_current" }, { sourcePublishedAt: null, sourceAccessedAt: "2026-09-30T10:00:00.000Z" })]),
      RESEARCHED_AT,
    );
    expect(temporal).toMatchObject({ currency: "stated_current", asOf: "2026-09-30", asOfBasis: "accessed", possiblyOutdated: false });
  });

  it("uses the 18-month boundary", () => {
    const at = (date: string) => temporalFor(claim([member("A", { currency: "stated_current" }, { sourcePublishedAt: date })]), RESEARCHED_AT).temporal.possiblyOutdated;
    expect(at("2025-04-01")).toBe(false);
    expect(at("2025-03-31")).toBe(true);
  });

  it("uses the freshest source that states the role as current", () => {
    const { temporal } = temporalFor(
      claim([
        member("A", { currency: "stated_current" }, { sourcePublishedAt: "2023-05-01" }),
        member("B", { currency: "stated_current" }, { sourcePublishedAt: "2026-06-01" }),
      ]),
      RESEARCHED_AT,
    );
    expect(temporal).toMatchObject({ currency: "stated_current", asOf: "2026-06-01", possiblyOutdated: false });
  });

  it("uses the access date for an undated official page", () => {
    const { temporal, uncertaintyNote } = temporalFor(
      claim([member("A", { currency: "stated_current" }, { sourcePublishedAt: null, sourceAccessedAt: "2026-09-30T08:00:00Z", sourceReliability: "official" })]),
      RESEARCHED_AT,
    );
    expect(temporal).toMatchObject({ currency: "stated_current", asOf: "2026-09-30", possiblyOutdated: false });
    expect(uncertaintyNote).toBeNull();
  });

  it("is ended when an end date is present, even if a source said current", () => {
    const { temporal } = temporalFor(claim([member("A", { currency: "stated_current" })], { start: { year: 2014 }, end: { year: 2018 } }), RESEARCHED_AT);
    expect(temporal).toMatchObject({ currency: "ended", asOf: null, possiblyOutdated: false });
  });

  it("is ended when a source says so without dates, and unknown otherwise", () => {
    expect(temporalFor(claim([member("A", { currency: "ended" })]), RESEARCHED_AT).temporal.currency).toBe("ended");
    expect(temporalFor(claim([member("A")]), RESEARCHED_AT).temporal.currency).toBe("unknown");
  });

  it("notes an end date before the start date and approximate starts", () => {
    expect(temporalFor(claim([member("A")], { start: { year: 2018 }, end: { year: 2016 } }), RESEARCHED_AT).uncertaintyNote).toMatch(/end date is earlier/);
    expect(temporalFor(claim([member("A")], { start: { year: 2015, approximate: true } }), RESEARCHED_AT).uncertaintyNote).toMatch(/approximate/);
  });
});

describe("pickHeadlineRole", () => {
  const temporal = (overrides: Partial<Temporal> = {}): Temporal => ({ start: null, end: null, currency: "unknown", asOf: null, possiblyOutdated: false, ...overrides });
  const role = (id: string, overrides: Partial<HeadlineCandidate> = {}): HeadlineCandidate => ({
    id,
    category: "employment",
    value: { kind: "employment", organisation: `Org ${id}`, title: `Title ${id}` },
    evidenceStatus: "single_source",
    temporal: temporal(),
    ...overrides,
  });

  it("returns null without employment claims", () => {
    expect(pickHeadlineRole([])).toBeNull();
    expect(pickHeadlineRole([role("L", { category: "location", value: { kind: "location", place: "Baku", scope: "based" } })])).toBeNull();
  });

  it("prefers a role stated as current by a recent source", () => {
    const pick = pickHeadlineRole([
      role("OLD_OPEN", { temporal: temporal({ start: { year: 2020 } }) }),
      role("CURRENT", { temporal: temporal({ currency: "stated_current", asOf: "2026-09-30", start: { year: 2014 } }) }),
    ]);
    expect(pick).toEqual({ claim: expect.objectContaining({ id: "CURRENT" }), confirmedCurrent: true });
  });

  it("ranks current roles by evidence", () => {
    const pick = pickHeadlineRole([
      role("WEAK", { evidenceStatus: "single_source", temporal: temporal({ currency: "stated_current", asOf: "2026-09-30" }) }),
      role("STRONG", { evidenceStatus: "multiple_sources", temporal: temporal({ currency: "stated_current", asOf: "2026-01-01" }) }),
    ]);
    expect(pick?.claim.id).toBe("STRONG");
  });

  it("falls back to the latest open-ended role, not confirmed as current", () => {
    const pick = pickHeadlineRole([
      role("OUTDATED", { temporal: temporal({ currency: "stated_current", asOf: "2022-01-01", possiblyOutdated: true, start: { year: 2016 } }) }),
      role("OPEN", { temporal: temporal({ start: { year: 2019 } }) }),
      role("ENDED", { temporal: temporal({ currency: "ended", start: { year: 2021 }, end: { year: 2023 } }) }),
    ]);
    expect(pick).toEqual({ claim: expect.objectContaining({ id: "OPEN" }), confirmedCurrent: false });
  });

  it("returns null when every role has ended", () => {
    expect(pickHeadlineRole([role("ENDED", { temporal: temporal({ currency: "ended", end: { year: 2020 } }) })])).toBeNull();
  });
});
