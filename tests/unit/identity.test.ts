import { describe, expect, it } from "vitest";
import { generateNameVariants } from "@/lib/names";
import {
  decideIdentity,
  evaluateCandidates,
  type CandidateDocument,
  type EvaluatedCandidate,
  type IdentityQuery,
} from "@/lib/research/pipeline/identity";
import type { DiscoveryCandidate } from "@/lib/research/schemas";
import { canonicaliseUrl } from "@/lib/urls/canonical";

function doc(key: string, url: string, title: string, snippet: string): CandidateDocument {
  return { key, url, canonicalUrl: canonicaliseUrl(url), title, snippet };
}

const DOCS: CandidateDocument[] = [
  doc("D1", "https://caspian.example/team/elnara", "Elnara Gasimova — Caspian Lantern Analytics", "Chief Executive Officer of Caspian Lantern Analytics, Baku."),
  doc("D2", "https://news.example/biz/caspian-funding", "Caspian Lantern raises funding", "Elnara Gasimova, CEO of Caspian Lantern Analytics, said the round..."),
  doc("D3", "https://caspian.example/news/2025", "Company news", "Caspian Lantern Analytics opens a Tashkent office."),
  doc("P1", "https://art.example/elnara", "Elnara Gasimova — watercolours", "Painter based in Sumgayit."),
  doc("P2", "https://gallery.example/shows/absheron", "Absheron coast show", "New watercolours by Elnara Gasimova."),
  doc("X1", "https://directory.example/gasimova", "Gasimova family", "A list of people named Gasimova."),
];

function candidate(ref: string, overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    candidate_ref: ref,
    display_name: "Elnara Gasimova",
    native_name: null,
    organisation: null,
    role: null,
    location: null,
    summary: "A person named Elnara Gasimova.",
    distinguishing_facts: [],
    source_ids: [],
    anchor_source_id: null,
    ...overrides,
  };
}

const CEO = candidate("ceo", {
  native_name: "Elnarə Qasımova",
  organisation: "Caspian Lantern Analytics MMC",
  role: "Chief Executive Officer",
  location: "Baku, Azerbaijan",
  summary: "Chief executive of a Baku data company.",
  distinguishing_facts: ["CEO of Caspian Lantern Analytics", "Based in Baku", "Data scientist", "Fourth fact"],
  source_ids: ["D1", "D2"],
  anchor_source_id: "D1",
});

const PAINTER = candidate("painter", {
  organisation: null,
  role: "Painter",
  location: "Sumgayit, Azerbaijan",
  summary: "Painter of Absheron coast watercolours.",
  source_ids: ["P1", "P2"],
  anchor_source_id: "P1",
});

function query(overrides: Partial<IdentityQuery> = {}): IdentityQuery {
  return { fullName: "Elnara Gasimova", company: null, country: null, profileUrl: null, ...overrides };
}

function evaluate(candidates: DiscoveryCandidate[], q: IdentityQuery = query(), documents: CandidateDocument[] = DOCS): EvaluatedCandidate[] {
  return evaluateCandidates(candidates, documents, q, generateNameVariants(q.fullName).map((v) => v.text));
}

const byName = (list: EvaluatedCandidate[], role: string) => list.find((c) => c.role === role)!;

describe("evaluateCandidates", () => {
  it("keeps same-name people as separate candidates", () => {
    const evaluated = evaluate([CEO, PAINTER]);
    expect(evaluated).toHaveLength(2);
    expect(evaluated.map((c) => c.nameMatch)).toEqual(["exact", "exact"]);
    expect(new Set(evaluated.map((c) => c.anchorKey)).size).toBe(2);
    expect(byName(evaluated, "Painter").sourceKeys).toEqual(["P1", "P2"]);
    expect(byName(evaluated, "Chief Executive Officer").sourceKeys).toEqual(["D1", "D2"]);
    expect(evaluated.map((c) => c.rank)).toEqual([1, 2]);
  });

  it("drops a source claimed by two candidates from both", () => {
    const evaluated = evaluate([{ ...CEO, source_ids: ["D1", "D2", "X1"] }, { ...PAINTER, source_ids: ["P1", "X1"] }]);
    expect(byName(evaluated, "Chief Executive Officer").sourceKeys).toEqual(["D1", "D2"]);
    expect(byName(evaluated, "Painter").sourceKeys).toEqual(["P1"]);
  });

  it("drops candidates left without any valid source", () => {
    const evaluated = evaluate([CEO, { ...PAINTER, source_ids: ["D1", "missing-doc"] }]);
    expect(evaluated).toHaveLength(1);
    expect(evaluated[0].role).toBe("Chief Executive Officer");
    // D1 was claimed by both, so the CEO keeps only D2.
    expect(evaluated[0].sourceKeys).toEqual(["D2"]);
  });

  it("records deterministic match reasons", () => {
    const [ceo] = evaluate([CEO], query({ company: "Caspian Lantern Analytics", country: "Azerbaijan" }));
    expect(ceo.matchReasons.map((r) => r.code)).toEqual(["name_exact", "company_match", "country_match", "role_context", "multiple_sources"]);
    expect(ceo.companyMatch).toBe(true);
    expect(ceo.independentDomains).toBe(2);
    expect(ceo.matchStrength).toBe("strong");
    expect(ceo.distinguishingFacts).toHaveLength(3);
  });

  it("records mismatches without dropping the candidate", () => {
    const [painter] = evaluate([{ ...PAINTER, organisation: "Sumgayit Art Space" }], query({ company: "Caspian Lantern Analytics", country: "Georgia" }));
    const codes = painter.matchReasons.map((r) => r.code);
    expect(codes).toContain("company_mismatch");
    expect(codes).toContain("country_mismatch");
    expect(painter.companyMatch).toBe(false);
  });

  it("matches the company from the candidate's own source text", () => {
    const [ceo] = evaluate([{ ...CEO, organisation: null }], query({ company: "Caspian Lantern" }));
    expect(ceo.companyMatch).toBe(true);
  });

  it("sees a transliterated query as a variant name match", () => {
    const evaluated = evaluate([CEO], query({ fullName: "Эльнара Гасымова" }));
    expect(evaluated[0].nameMatch).toBe("variant");
    expect(evaluated[0].matchReasons[0].code).toBe("name_variant");
    expect(evaluated[0].nameVariants).toEqual(expect.arrayContaining(["Elnara Gasimova", "Elnarə Qasımova", "Эльнара Гасымова"]));
  });

  it("marks a similar-spelling-only name as weak", () => {
    const [weak] = evaluate([{ ...CEO, display_name: "Elnora Gasimova", native_name: null, source_ids: ["D1"] }]);
    expect(weak.nameMatch).toBe("phonetic");
    expect(weak.matchStrength).toBe("weak");
  });

  it("detects the supplied profile URL by canonical URL", () => {
    const [ceo] = evaluate([CEO], query({ profileUrl: "https://www.caspian.example/team/elnara/?utm_source=linkedin#bio" }));
    expect(ceo.profileUrlMatch).toBe(true);
    expect(ceo.matchReasons[0]).toMatchObject({ code: "profile_url_match", sourceKeys: ["D1"] });
    expect(ceo.matchStrength).toBe("strong");
  });

  it("derives stable anchor keys", () => {
    const [anchored] = evaluate([CEO]);
    expect(anchored.anchorKey).toBe("url:https://caspian.example/team/elnara");
    expect(anchored.anchorUrls).toEqual(["https://caspian.example/team/elnara"]);
    const [fixture] = evaluate([{ ...CEO, candidate_ref: "fixture:elnara-gasimova#0" }]);
    expect(fixture.fixturePersonKey).toBe("elnara-gasimova");
    expect(fixture.anchorKey).toBe("fixture:elnara-gasimova");
    const [unanchored] = evaluate([{ ...CEO, anchor_source_id: null }]);
    expect(unanchored.anchorKey).toBe("name:elnara gasimova|org:caspian-lantern-analytics|src:caspian.example,news.example");
  });

  it("ranks stronger candidates first", () => {
    const evaluated = evaluate([PAINTER, CEO], query({ company: "Caspian Lantern Analytics" }));
    expect(evaluated.map((c) => [c.rank, c.role, c.matchStrength])).toEqual([
      [1, "Chief Executive Officer", "strong"],
      [2, "Painter", "moderate"],
    ]);
  });
});

describe("decideIdentity", () => {
  it("returns none without candidates", () => {
    expect(decideIdentity([], query())).toMatchObject({ decision: "none" });
  });

  it("never auto-selects on a name alone, even with a single candidate", () => {
    const evaluated = evaluate([CEO]);
    expect(evaluated[0].nameMatch).toBe("exact");
    expect(decideIdentity(evaluated, query())).toEqual({
      decision: "ask",
      reason: "One possible match was found, but a name alone is not enough to confirm identity.",
    });
  });

  it("asks when several people share the name", () => {
    expect(decideIdentity(evaluate([CEO, PAINTER]), query())).toEqual({ decision: "ask", reason: "2 different people match this name." });
  });

  it("auto-selects the only candidate whose sources include the supplied profile URL", () => {
    const q = query({ profileUrl: "https://caspian.example/team/elnara" });
    const evaluated = evaluate([PAINTER, CEO], q);
    const decision = decideIdentity(evaluated, q);
    expect(decision).toMatchObject({ decision: "auto", method: "auto_profile_url" });
    expect(decision.decision === "auto" && evaluated.find((c) => c.rank === decision.rank)?.role).toBe("Chief Executive Officer");
  });

  it("does not auto-select by profile URL when two candidates match it", () => {
    const docs = [...DOCS, doc("P3", "https://caspian.example/team/elnara?ref=footer", "Elnara Gasimova", "Painter")];
    const q = query({ profileUrl: "https://caspian.example/team/elnara" });
    const evaluated = evaluate([CEO, { ...PAINTER, source_ids: ["P1", "P3"] }], q, docs);
    expect(evaluated.filter((c) => c.profileUrlMatch)).toHaveLength(2);
    expect(decideIdentity(evaluated, q)).toMatchObject({ decision: "ask" });
  });

  it("does not auto-select when the profile URL matches no candidate", () => {
    const q = query({ profileUrl: "https://linkedin.example/in/someone-else" });
    expect(decideIdentity(evaluate([CEO]), q)).toMatchObject({ decision: "ask" });
  });

  it("auto-selects a unique company match with a matching name and two independent websites", () => {
    const q = query({ company: "Caspian Lantern Analytics" });
    const evaluated = evaluate([CEO, PAINTER], q);
    expect(decideIdentity(evaluated, q)).toMatchObject({ decision: "auto", method: "auto_unique_company_match", rank: 1 });
  });

  it("does not auto-select a company match supported by a single website", () => {
    const q = query({ company: "Caspian Lantern Analytics" });
    const evaluated = evaluate([{ ...CEO, source_ids: ["D1", "D3"] }], q);
    expect(evaluated[0]).toMatchObject({ companyMatch: true, independentDomains: 1 });
    expect(decideIdentity(evaluated, q)).toMatchObject({ decision: "ask" });
  });

  it("does not auto-select a company match whose name only sounds similar", () => {
    const q = query({ company: "Caspian Lantern Analytics" });
    const evaluated = evaluate([{ ...CEO, display_name: "Elnora Gasimova", native_name: null }], q);
    expect(evaluated[0]).toMatchObject({ companyMatch: true, nameMatch: "phonetic", independentDomains: 2 });
    expect(decideIdentity(evaluated, q)).toMatchObject({ decision: "ask" });
  });

  it("does not auto-select when two candidates match the company", () => {
    const q = query({ company: "Caspian Lantern Analytics" });
    const evaluated = evaluate([CEO, { ...PAINTER, organisation: "Caspian Lantern Analytics", source_ids: ["P1", "P2"] }], q);
    expect(evaluated.filter((c) => c.companyMatch)).toHaveLength(2);
    expect(decideIdentity(evaluated, q)).toMatchObject({ decision: "ask" });
  });

  it("a transliterated name match alone does not select", () => {
    const q = query({ fullName: "Эльнара Гасымова", country: "Azerbaijan" });
    const evaluated = evaluate([CEO], q);
    expect(evaluated[0].nameMatch).toBe("variant");
    expect(decideIdentity(evaluated, q)).toMatchObject({ decision: "ask" });
  });

  it("a transliterated name with a unique company match can select", () => {
    const q = query({ fullName: "Эльнара Гасымова", company: "Caspian Lantern Analytics" });
    expect(decideIdentity(evaluate([CEO], q), q)).toMatchObject({ decision: "auto", method: "auto_unique_company_match" });
  });

  it("always asks when automatic selection is turned off", () => {
    const q = query({ company: "Caspian Lantern Analytics", profileUrl: "https://caspian.example/team/elnara" });
    expect(decideIdentity(evaluate([CEO], q), q, false)).toEqual({ decision: "ask", reason: "Automatic selection was turned off for this search." });
  });
});
