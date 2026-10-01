import { describe, expect, it } from "vitest";
import type { FixtureDocument } from "@/fixtures/types";
import { FIXTURE_BUNDLES, fixtureDocumentsForVersion } from "@/fixtures/world";
import { compareNames, detectScript } from "@/lib/names";
import { FixtureReasoningProvider, FixtureSearchProvider, resolveFixtureDate, type FixtureRunContext } from "@/lib/research/providers/fixture";
import { ProviderError, type EvidenceDocument, type SearchHit, type SearchRequest } from "@/lib/research/providers/types";
import { registrableDomain } from "@/lib/urls/canonical";

const RUN_DATE = "2026-10-01";

function context(overrides: Partial<FixtureRunContext> = {}): FixtureRunContext {
  return { worldVersion: 1, isRetry: false, runDate: RUN_DATE, latencyMs: 0, ...overrides };
}

function request(query: string, overrides: Partial<SearchRequest> = {}): SearchRequest {
  return { query, category: "discovery", language: null, topic: "general", maxResults: 100, ...overrides };
}

const signal = () => new AbortController().signal;
const keysOf = (hits: SearchHit[]) => hits.map((h) => h.fixtureKey);
const docsV1 = () => fixtureDocumentsForVersion(1);

function toEvidence(hits: SearchHit[]): EvidenceDocument[] {
  return hits.map((h, i) => ({
    id: `S${i + 1}`,
    url: h.url,
    title: h.title,
    publisher: null,
    providerPublishedDate: h.providerPublishedDate,
    access: "snippet_only",
    text: h.snippet,
    fixtureKey: h.fixtureKey,
  }));
}

describe("fixture world", () => {
  it("is populated", () => {
    expect(FIXTURE_BUNDLES.length).toBeGreaterThan(0);
    expect(docsV1().length).toBeGreaterThan(0);
  });
});

describe("FixtureSearchProvider.search", () => {
  it("matches names phonetically across scripts", async () => {
    const provider = new FixtureSearchProvider(context());
    const hits = (await provider.search(request('"Эльнара Гасымова"'), signal())).hits;
    // Documents that spell the name only in Latin script are still found by a Cyrillic query.
    const latinOnly = docsV1().filter(
      (d) => d.categories.includes("discovery") && d.nameForms.length > 0 && d.nameForms.every((f) => detectScript(f) === "latin") && d.nameForms.some((f) => compareNames("Elnara Gasimova", f) === "exact"),
    );
    expect(latinOnly.length).toBeGreaterThan(0);
    expect(keysOf(hits)).toEqual(expect.arrayContaining(latinOnly.map((d) => d.key)));

    // And the other way round.
    const latinHits = (await provider.search(request('"Elnara Gasimova"'), signal())).hits;
    const cyrillicOnly = docsV1().filter(
      (d) => d.categories.includes("discovery") && d.nameForms.length > 0 && d.nameForms.every((f) => detectScript(f) === "cyrillic") && d.nameForms.some((f) => compareNames("Elnara Gasimova", f) === "variant"),
    );
    expect(cyrillicOnly.length).toBeGreaterThan(0);
    expect(keysOf(latinHits)).toEqual(expect.arrayContaining(cyrillicOnly.map((d) => d.key)));
  });

  it("does not return documents for a different name", async () => {
    const provider = new FixtureSearchProvider(context());
    const hits = (await provider.search(request('"Elnara Kasimova"'), signal())).hits;
    expect(hits).toEqual([]);
  });

  it("only returns documents in the requested category and world version", async () => {
    const provider = new FixtureSearchProvider(context());
    const hits = (await provider.search(request('"Elnara Gasimova"', { category: "career" }), signal())).hits;
    expect(hits.length).toBeGreaterThan(0);
    const byKey = new Map(docsV1().map((d) => [d.key, d]));
    for (const hit of hits) {
      const doc = byKey.get(hit.fixtureKey!);
      expect(doc, `${hit.fixtureKey} is a version-1 document`).toBeDefined();
      expect(doc!.categories).toContain("career");
    }
  });

  it("respects maxResults", async () => {
    const provider = new FixtureSearchProvider(context());
    const all = (await provider.search(request('"Elnara Gasimova"'), signal())).hits;
    expect(all.length).toBeGreaterThan(1);
    const one = (await provider.search(request('"Elnara Gasimova"', { maxResults: 1 }), signal())).hits;
    expect(keysOf(one)).toEqual(keysOf(all).slice(0, 1));
  });

  it("honours includeDomains", async () => {
    const provider = new FixtureSearchProvider(context());
    const unrestricted = (await provider.search(request('"Elnara Gasimova"', { category: "accounts" }), signal())).hits;
    const domains = new Set(unrestricted.map((h) => registrableDomain(h.url)));
    expect(domains.size).toBeGreaterThan(1);
    const [onlyDomain] = [...domains];
    const restricted = (await provider.search(request('"Elnara Gasimova"', { category: "accounts", includeDomains: [onlyDomain!.toUpperCase()] }), signal())).hits;
    expect(restricted.length).toBeGreaterThan(0);
    expect(restricted.every((h) => registrableDomain(h.url) === onlyDomain)).toBe(true);
    expect(restricted.length).toBeLessThan(unrestricted.length);
  });

  it("returns page text only for non-discovery searches of readable pages", async () => {
    const provider = new FixtureSearchProvider(context());
    const discovery = (await provider.search(request('"Elnara Gasimova"'), signal())).hits;
    expect(discovery.every((h) => h.rawContent === null)).toBe(true);
    const career = (await provider.search(request('"Elnara Gasimova"', { category: "career" }), signal())).hits;
    const byKey = new Map(docsV1().map((d) => [d.key, d]));
    for (const hit of career) {
      const doc = byKey.get(hit.fixtureKey!)!;
      expect(hit.rawContent).toBe(doc.access === "read" ? doc.body : null);
    }
  });

  it("reports the provider date and resolves the run-date placeholder", async () => {
    expect(resolveFixtureDate("@run-date", RUN_DATE)).toBe(RUN_DATE);
    expect(resolveFixtureDate("2025-03-12", RUN_DATE)).toBe("2025-03-12");
    expect(resolveFixtureDate(null, RUN_DATE)).toBeNull();

    const provider = new FixtureSearchProvider(context());
    const hits = (await provider.search(request('"Elnara Gasimova"', { category: "career" }), signal())).hits;
    const byKey = new Map(docsV1().map((d) => [d.key, d]));
    for (const hit of hits) {
      const doc = byKey.get(hit.fixtureKey!)!;
      expect(hit.providerPublishedDate).toBe(resolveFixtureDate(doc.providerPublishedDate ?? doc.publishedDate, RUN_DATE));
    }
  });

  describe("simulated failures", () => {
    const failing = FIXTURE_BUNDLES.flatMap((b) => (b.person.failures ?? []).map((f) => ({ person: b.person, failure: f })));

    it("exist in the demo world", () => {
      expect(failing.length).toBeGreaterThan(0);
    });

    it.each(failing.map((f) => [f.person.key, f.failure.category, f.failure.kind, f] as const))("%s: the %s search fails with %s", async (_key, _category, _kind, { person, failure }) => {
      const provider = new FixtureSearchProvider(context());
      const error = await provider.search(request(`"${person.displayName}"`, { category: failure.category, topic: failure.category === "news" ? "news" : "general" }), signal()).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ provider: "fixture", kind: failure.kind });

      const retry = new FixtureSearchProvider(context({ isRetry: true }));
      const outcome = retry.search(request(`"${person.displayName}"`, { category: failure.category }), signal());
      if (failure.untilRetry) await expect(outcome).resolves.toMatchObject({ hits: expect.any(Array) });
      else await expect(outcome).rejects.toBeInstanceOf(ProviderError);
    });

    it("does not affect searches for other people", async () => {
      const { person, failure } = failing[0];
      const other = FIXTURE_BUNDLES.find((b) => compareNames(person.displayName, b.person.displayName) === "none" && !(b.person.failures ?? []).length)!;
      const provider = new FixtureSearchProvider(context());
      await expect(provider.search(request(`"${other.person.displayName}"`, { category: failure.category }), signal())).resolves.toBeDefined();
    });
  });
});

describe("FixtureSearchProvider.extract", () => {
  const firstWith = (predicate: (d: FixtureDocument) => boolean) => docsV1().find(predicate);

  it("returns readable pages and reports pages it could not read", async () => {
    const read = firstWith((d) => d.access === "read" && Boolean(d.body))!;
    const login = firstWith((d) => d.access === "login_required");
    const paywalled = firstWith((d) => d.access === "paywalled");
    const snippet = firstWith((d) => d.access === "snippet_only");
    expect(login && paywalled && snippet, "fixture world covers every access type").toBeTruthy();

    const provider = new FixtureSearchProvider(context());
    const urls = [read.url, login!.url, paywalled!.url, snippet!.url, "https://unknown.example/page"];
    const response = await provider.extract(urls, signal());

    expect(response.pages).toEqual([{ url: read.url, title: read.title, content: read.body, fixtureKey: read.key }]);
    expect(response.failed).toEqual([
      { url: login!.url, reason: "Login required; the page was not accessed." },
      { url: paywalled!.url, reason: "Paywalled; only the search snippet is available." },
      { url: snippet!.url, reason: "Page content unavailable; only the search snippet is available." },
      { url: "https://unknown.example/page", reason: "Page not found." },
    ]);
    expect(response.usage).toEqual({ requests: 1, credits: 0 });
  });
});

describe("FixtureReasoningProvider.discoverCandidates", () => {
  async function discover(name: string) {
    const search = new FixtureSearchProvider(context());
    const hits = (await search.search(request(`"${name}"`), signal())).hits;
    const documents = toEvidence(hits);
    const reasoning = new FixtureReasoningProvider(context());
    const { output } = await reasoning.discoverCandidates({ query: { fullName: name, company: null, country: null, profileUrl: null }, nameVariants: [name], documents }, signal());
    return { output, documents };
  }

  it.each(["Tural Mammadov", "Elnara Gasimova"])("keeps people named %s apart", async (name) => {
    const { output, documents } = await discover(name);
    const namesakes = FIXTURE_BUNDLES.filter((b) => documents.some((d) => b.extraction[d.fixtureKey!]?.source.about_subject === "yes"));
    expect(namesakes.length).toBeGreaterThan(1);
    expect(output.candidates).toHaveLength(namesakes.length);

    // One candidate per person, each with its own sources.
    expect(new Set(output.candidates.map((c) => c.candidate_ref)).size).toBe(output.candidates.length);
    const allSources = output.candidates.flatMap((c) => c.source_ids);
    expect(new Set(allSources).size).toBe(allSources.length);
    for (const c of output.candidates) {
      expect(compareNames(name, c.display_name)).not.toBe("none");
      const personKey = c.candidate_ref.slice("fixture:".length).split("#")[0];
      const bundle = FIXTURE_BUNDLES.find((b) => b.person.key === personKey)!;
      for (const id of c.source_ids) {
        const doc = documents.find((d) => d.id === id)!;
        expect(bundle.extraction[doc.fixtureKey!]?.source.about_subject).toBe("yes");
      }
    }
    // Different organisations or locations distinguish the namesakes.
    const contexts = output.candidates.map((c) => `${c.organisation ?? ""}|${c.location ?? ""}|${c.role ?? ""}`);
    expect(new Set(contexts).size).toBe(contexts.length);
  });

  it("leaves results that describe nobody in particular unassigned", async () => {
    const { output, documents } = await discover("Elnara Gasimova");
    const assigned = new Set(output.candidates.flatMap((c) => c.source_ids));
    expect([...assigned, ...output.unassigned_source_ids].sort()).toEqual(documents.map((d) => d.id).sort());
    for (const id of output.unassigned_source_ids) {
      const doc = documents.find((d) => d.id === id)!;
      expect(FIXTURE_BUNDLES.some((b) => b.extraction[doc.fixtureKey!]?.source.about_subject === "yes")).toBe(false);
    }
  });
});

describe("FixtureReasoningProvider.extractEvidence", () => {
  it("treats documents outside the selected person's bundle as not about them", async () => {
    const [ceo, namesake] = FIXTURE_BUNDLES.filter((b) => compareNames("Elnara Gasimova", b.person.displayName) !== "none");
    expect(ceo && namesake).toBeTruthy();
    const ceoDoc = ceo.documents.find((d) => ceo.extraction[d.key]?.source.about_subject === "yes" && (d.versions ?? [1, 2]).includes(1))!;
    const reasoning = new FixtureReasoningProvider(context());
    const subject = { displayName: namesake.person.displayName, nativeName: null, nameVariants: [], organisation: null, role: null, location: null, distinguishingFacts: [] };
    const document: EvidenceDocument = { id: "S1", url: ceoDoc.url, title: ceoDoc.title, publisher: null, providerPublishedDate: null, access: "full_text", text: ceoDoc.body ?? ceoDoc.snippet, fixtureKey: ceoDoc.key };

    const asNamesake = await reasoning.extractEvidence({ subject: { ...subject, fixturePersonKey: namesake.person.key }, documents: [document], researchedAt: `${RUN_DATE}T09:00:00Z` }, signal());
    expect(asNamesake.output.sources).toEqual([expect.objectContaining({ source_id: "S1", about_subject: "no" })]);
    expect(asNamesake.output.facts).toEqual([]);

    const asCeo = await reasoning.extractEvidence({ subject: { ...subject, fixturePersonKey: ceo.person.key }, documents: [document], researchedAt: `${RUN_DATE}T09:00:00Z` }, signal());
    expect(asCeo.output.sources).toEqual([expect.objectContaining({ source_id: "S1", about_subject: "yes" })]);
    for (const item of [...asCeo.output.facts, ...asCeo.output.contacts, ...asCeo.output.accounts, ...asCeo.output.relationships, ...asCeo.output.media]) {
      expect(item.source_id).toBe("S1");
    }
  });
});
