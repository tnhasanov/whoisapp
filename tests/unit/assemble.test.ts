import { describe, expect, it } from "vitest";
import type { CoverageEntry } from "@/lib/domain/types";
import { assembleSnapshot, documentTextForModel, type AssembleDocument, type AssembleInput, type DraftSnapshot } from "@/lib/research/pipeline/assemble";
import type {
  ExtractedAccount,
  ExtractedContact,
  ExtractedFact,
  ExtractedMedia,
  ExtractedRelationship,
  ExtractedSource,
  ExtractionOutput,
} from "@/lib/research/schemas";
import { canonicaliseUrl } from "@/lib/urls/canonical";

/* --------------------------------- Builders -------------------------------- */

const RESEARCHED_AT = "2026-10-01T09:00:00.000Z";
const FETCHED_AT = "2026-10-01T08:55:00.000Z";

function doc(key: string, url: string, content: string | null, overrides: Partial<AssembleDocument> = {}): AssembleDocument {
  return {
    key,
    url,
    canonicalUrl: canonicaliseUrl(url),
    title: null,
    publisher: null,
    snippet: null,
    content,
    accessMethod: content ? "provider_extract" : "search_snippet",
    accessStatus: content ? "read" : "snippet_only",
    accessNote: null,
    providerPublishedAt: null,
    categories: ["career"],
    fixtureKey: null,
    fetchedAt: FETCHED_AT,
    ...overrides,
  };
}

function source(source_id: string, overrides: Partial<ExtractedSource> = {}): ExtractedSource {
  return {
    source_id,
    about_subject: "yes",
    identity_evidence: "Names the subject as CEO of Caspian Lantern Analytics.",
    source_type: "news",
    page_language: "en",
    published_date: null,
    updated_date: null,
    self_published: false,
    ...overrides,
  };
}

function fact(source_id: string, supporting_excerpt: string, overrides: Partial<ExtractedFact> = {}): ExtractedFact {
  return {
    source_id,
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
    supporting_excerpt,
    english_rendering: null,
    ...overrides,
  };
}

function contact(source_id: string, value: string, supporting_excerpt: string, overrides: Partial<ExtractedContact> = {}): ExtractedContact {
  return {
    source_id,
    contact_type: "office_line",
    value,
    belongs_to: "person",
    owner_label: "Elnara Gasimova",
    purpose: null,
    publication_context: "Contact details",
    supporting_excerpt,
    ...overrides,
  };
}

function account(source_id: string, url: string, supporting_excerpt: string, overrides: Partial<ExtractedAccount> = {}): ExtractedAccount {
  return {
    source_id,
    platform: "linkedin",
    url,
    handle: null,
    description: null,
    discovery: "search_result",
    supporting_excerpt,
    identity_evidence: "Same name and employer.",
    ...overrides,
  };
}

function relationship(source_id: string, counterpart_name: string, supporting_excerpt: string, overrides: Partial<ExtractedRelationship> = {}): ExtractedRelationship {
  return {
    source_id,
    relation_type: "co_founder",
    counterpart_name,
    counterpart_role: null,
    organisation: "Caspian Lantern Analytics",
    project: null,
    start: null,
    end: null,
    supporting_excerpt,
    ...overrides,
  };
}

function media(source_id: string, headline: string, overrides: Partial<ExtractedMedia> = {}): ExtractedMedia {
  return {
    source_id,
    headline,
    outlet: "Baku Business News",
    kind: "article",
    published_date: null,
    event_date: null,
    language: "en",
    summary: "An original summary of the article.",
    involvement: "Quoted as chief executive.",
    coverage_type: "direct",
    topic: "business",
    identity_evidence: "Names her as CEO of Caspian Lantern Analytics.",
    allegations: null,
    ...overrides,
  };
}

function extraction(parts: Partial<ExtractionOutput>): ExtractionOutput {
  return { sources: [], facts: [], contacts: [], accounts: [], relationships: [], media: [], ...parts };
}

function assemble(
  documents: AssembleDocument[],
  extractions: ExtractionOutput[],
  overrides: Partial<Omit<AssembleInput, "documents" | "extractions">> = {},
): DraftSnapshot {
  return assembleSnapshot({
    identity: { displayName: "Elnara Gasimova", nativeName: "Elnarə Qasımova", nameVariants: ["Elnara Gasimova", "Elnarə Qasımova", "Эльнара Гасымова"] },
    documents,
    analysedKeys: documents.map((d) => d.key),
    notAnalysed: [],
    extractions,
    blocked: [],
    coverage: [],
    researchedAt: RESEARCHED_AT,
    maxSourceChars: 24_000,
    ...overrides,
  });
}

const rejectionsOf = (draft: DraftSnapshot, kind: string) => draft.rejected.filter((r) => r.kind === kind).map((r) => [r.reason, r.sourceKey]);

/* -------------------------------- Documents -------------------------------- */

const BIO_TEXT = [
  "Elnara Gasimova is the Chief Executive Officer of Caspian Lantern Analytics.",
  "She co-founded the company in 2014 with Rauf Aliyev.",
  "Earlier she worked at Absheron Data Partners, where Leyla Huseynova also worked as an analyst.",
  "Office: +994 12 555 01 23. Reception: +994 12 555 01 00.",
  "Follow her on LinkedIn: linkedin.example/in/elnara-gasimova",
].join("\n");

const BIO = doc("BIO", "https://caspian.example/team/elnara", BIO_TEXT, { title: "Elnara Gasimova — Leadership" });
const BIO_SOURCE = source("BIO", { source_type: "official_bio" });

const WIRE_TEXT =
  "Caspian Lantern Analytics, a Baku data company led by chief executive Elnara Gasimova, said on Tuesday it had raised 4 million dollars from regional investors to expand its logistics forecasting platform across the Caspian region and Central Asia. Gasimova, who founded the company in 2015, said the money would fund new hires.";

/* ---------------------------------- Tests ---------------------------------- */

describe("documentTextForModel", () => {
  it("uses the page text (cut to the limit) for read documents and title + snippet otherwise", () => {
    expect(documentTextForModel({ accessStatus: "read", content: "abcdef", title: "T", snippet: "S" }, 3)).toBe("abc");
    expect(documentTextForModel({ accessStatus: "snippet_only", content: null, title: "T", snippet: "S" }, 3)).toBe("T\nS");
    expect(documentTextForModel({ accessStatus: "paywalled", content: "hidden", title: null, snippet: "S" }, 100)).toBe("S");
  });
});

describe("assembleSnapshot: facts", () => {
  it("turns a verified fact from an official bio into a claim", () => {
    const draft = assemble(
      [BIO],
      [extraction({ sources: [BIO_SOURCE], facts: [fact("BIO", "Elnara Gasimova is the Chief Executive Officer of Caspian Lantern Analytics", { currency: "stated_current" })] })],
    );
    expect(draft.claims).toHaveLength(1);
    const [claim] = draft.claims;
    expect(claim).toMatchObject({
      tempId: "C1",
      category: "employment",
      value: { kind: "employment", organisation: "Caspian Lantern Analytics", title: "Chief Executive Officer" },
      displayValue: "Chief Executive Officer, Caspian Lantern Analytics",
      evidenceStatus: "official_source",
      conflictGroup: null,
      sources: [{ sourceKey: "BIO", excerptVerified: true }],
    });
    // Undated official page: "stated as current when accessed".
    expect(claim.temporal).toMatchObject({ currency: "stated_current", asOf: "2026-10-01", possiblyOutdated: false });
    expect(draft.headline).toMatchObject({ roleClaimTempId: "C1", role: "Chief Executive Officer", organisation: "Caspian Lantern Analytics", roleConfirmedCurrent: true });
    expect(draft.organisations).toEqual([{ name: "Caspian Lantern Analytics", normalisedName: "caspian-lantern-analytics", kind: "company" }]);
  });

  it("rejects a fact whose excerpt is not in the document text", () => {
    const draft = assemble([BIO], [extraction({ sources: [BIO_SOURCE], facts: [fact("BIO", "Elnara Gasimova was appointed chair of the board in 2020")] })]);
    expect(draft.claims).toEqual([]);
    expect(rejectionsOf(draft, "fact")).toEqual([["excerpt_not_found", "BIO"]]);
  });

  it("verifies excerpts against the same truncated text the model was shown", () => {
    const draft = assemble(
      [BIO],
      [extraction({ sources: [BIO_SOURCE], facts: [fact("BIO", "Elnara Gasimova is the Chief Executive Officer of Caspian Lantern Analytics")] })],
      { maxSourceChars: 40 },
    );
    expect(draft.claims).toEqual([]);
    expect(rejectionsOf(draft, "fact")).toEqual([["excerpt_not_found", "BIO"]]);
  });

  it("rejects facts from sources about someone else or of unclear identity", () => {
    const other = doc("OTHER", "https://art.example/elnara", "Elnara Gasimova is a painter and the director of Sumgayit Art Space.");
    const unclear = doc("UNCLEAR", "https://forum.example/t/1", "Elnara Gasimova is the director of a company, a user wrote.");
    const draft = assemble(
      [other, unclear],
      [
        extraction({
          sources: [source("OTHER", { about_subject: "no" }), source("UNCLEAR", { about_subject: "unclear" })],
          facts: [
            fact("OTHER", "Elnara Gasimova is a painter and the director of Sumgayit Art Space", { organisation: "Sumgayit Art Space", title: "Director" }),
            fact("UNCLEAR", "Elnara Gasimova is the director of a company", { title: "Director" }),
          ],
        }),
      ],
    );
    expect(draft.claims).toEqual([]);
    expect(rejectionsOf(draft, "fact")).toEqual([
      ["identity_not_confirmed", "OTHER"],
      ["identity_not_confirmed", "UNCLEAR"],
    ]);
  });

  it("downgrades a 'yes' source whose text never names the subject to 'unclear'", () => {
    const team = doc("TEAM", "https://caspian.example/about", "The chief executive leads a team of forty analysts in Baku.", { title: "About us" });
    const draft = assemble(
      [team],
      [extraction({ sources: [source("TEAM", { source_type: "company_site" })], facts: [fact("TEAM", "The chief executive leads a team of forty analysts")] })],
    );
    expect(draft.claims).toEqual([]);
    expect(rejectionsOf(draft, "fact")).toEqual([["identity_not_confirmed", "TEAM"]]);
    const src = draft.sources.find((s) => s.key === "TEAM")!;
    expect(src.aboutSubject).toBe("unclear");
    expect(src.accessNote).toMatch(/name does not appear/);
  });

  it("accepts a source that names the subject in another script", () => {
    const ru = doc("RU", "https://ru-news.example/a", "Эльнара Гасымова — генеральный директор компании Caspian Lantern Analytics.");
    const draft = assemble(
      [ru],
      [
        extraction({
          sources: [source("RU", { page_language: "ru" })],
          facts: [
            fact("RU", "Эльнара Гасымова — генеральный директор компании Caspian Lantern Analytics", {
              title: "Генеральный директор",
              english_rendering: "Chief Executive Officer",
            }),
          ],
        }),
      ],
    );
    expect(draft.claims).toHaveLength(1);
    expect(draft.claims[0]).toMatchObject({
      value: { title: "Chief Executive Officer" },
      originalText: "Генеральный директор",
      isTranslated: true,
      language: "ru",
    });
  });

  it("rejects items that cite an unknown or unanalysed source", () => {
    const notAnalysed = doc("LATER", "https://news.example/later", "Elnara Gasimova is the Chief Executive Officer of Caspian Lantern Analytics.");
    const draft = assemble(
      [BIO, notAnalysed],
      [
        extraction({
          sources: [BIO_SOURCE, source("LATER")],
          facts: [fact("GHOST", "Elnara Gasimova is the Chief Executive Officer"), fact("LATER", "Elnara Gasimova is the Chief Executive Officer")],
          contacts: [contact("GHOST", "+994 12 555 01 23", "Office: +994 12 555 01 23")],
          accounts: [account("GHOST", "https://linkedin.example/in/elnara-gasimova", "linkedin.example/in/elnara-gasimova")],
          relationships: [relationship("GHOST", "Rauf Aliyev", "co-founded the company in 2014 with Rauf Aliyev")],
          media: [media("GHOST", "Ghost headline")],
        }),
      ],
      { analysedKeys: ["BIO"], notAnalysed: [{ key: "LATER", reason: "budget" }] },
    );
    expect(draft.claims).toEqual([]);
    expect(draft.rejected.map((r) => [r.kind, r.reason, r.sourceKey])).toEqual([
      ["fact", "unknown_source", null],
      ["fact", "unknown_source", null],
      ["contact", "unknown_source", null],
      ["account", "unknown_source", null],
      ["relationship", "unknown_source", null],
      ["media", "unknown_source", null],
    ]);
    expect(draft.sources.find((s) => s.key === "LATER")?.accessNote).toMatch(/research budget was reached/);
    expect(draft.gaps.map((g) => g.code)).toContain("budget_limited");
    expect(draft.stats).toMatchObject({ analysedSources: 1, notAnalysedSources: 1, rejectedItems: 6 });
  });

  it("rejects facts with invalid dates", () => {
    const draft = assemble([BIO], [extraction({ sources: [BIO_SOURCE], facts: [fact("BIO", "co-founded the company in 2014", { start: "2014-13" })] })]);
    expect(rejectionsOf(draft, "fact")).toEqual([["invalid_fields", "BIO"]]);
  });

  it("keeps conflicting start dates from two sources as two claims in one conflict group", () => {
    const news = doc("NEWS", "https://news.example/biz/caspian", WIRE_TEXT, { title: "Caspian Lantern raises $4m" });
    const draft = assemble(
      [BIO, news],
      [
        extraction({
          sources: [BIO_SOURCE, source("NEWS", { published_date: "2026-03-10" })],
          facts: [
            fact("BIO", "She co-founded the company in 2014", { title: "Co-founder & CEO", start: "2014" }),
            fact("NEWS", "Gasimova, who founded the company in 2015", { title: "CEO", start: "2015" }),
          ],
        }),
      ],
    );
    expect(draft.claims).toHaveLength(2);
    const [a, b] = draft.claims;
    expect(a.conflictGroup).toBe("conflict:employment|caspian-lantern-analytics|chief-executive-officer");
    expect(b.conflictGroup).toBe(a.conflictGroup);
    expect([a.evidenceStatus, b.evidenceStatus]).toEqual(["conflicting", "conflicting"]);
    expect(draft.claims.map((c) => c.temporal.start?.year).sort()).toEqual([2014, 2015]);
    expect(a.claimKey).not.toBe(b.claimKey);
  });

  it("does not count syndicated copies as independent corroboration", () => {
    const original = doc("WIRE", "https://wire.example/caspian", WIRE_TEXT);
    const copy = doc("COPY", "https://daily.example/biz/caspian", `${WIRE_TEXT} Reporting by staff.`);
    const draft = assemble(
      [original, copy],
      [
        extraction({
          sources: [source("WIRE"), source("COPY")],
          facts: [fact("WIRE", "led by chief executive Elnara Gasimova"), fact("COPY", "led by chief executive Elnara Gasimova")],
        }),
      ],
    );
    expect(draft.sources.map((s) => s.syndicationGroup)).toEqual(["syn:WIRE", "syn:WIRE"]);
    expect(draft.claims).toHaveLength(1);
    expect(draft.claims[0].sources.map((s) => s.sourceKey)).toEqual(["WIRE", "COPY"]);
    expect(draft.claims[0].evidenceStatus).toBe("single_source");
  });

  it("needs two independent publishers for multiple_sources", () => {
    const news = doc("NEWS", "https://news.example/biz/caspian", WIRE_TEXT);
    const draft = assemble(
      [BIO, news],
      [
        extraction({
          sources: [BIO_SOURCE, source("NEWS")],
          facts: [fact("BIO", "Elnara Gasimova is the Chief Executive Officer"), fact("NEWS", "led by chief executive Elnara Gasimova", { title: "Chief Executive" })],
        }),
      ],
    );
    expect(draft.claims).toHaveLength(1);
    expect(draft.claims[0].evidenceStatus).toBe("multiple_sources");
  });

  it("marks claims supported only by snippets", () => {
    const listing = doc("SNIP", "https://directory.example/elnara", null, {
      title: "Elnara Gasimova - Caspian Lantern Analytics",
      snippet: "Elnara Gasimova, Chief Executive Officer at Caspian Lantern Analytics, Baku.",
    });
    const draft = assemble([listing], [extraction({ sources: [source("SNIP", { source_type: "other" })], facts: [fact("SNIP", "Chief Executive Officer at Caspian Lantern Analytics")] })]);
    expect(draft.claims[0].evidenceStatus).toBe("snippet_only");
  });
});

describe("assembleSnapshot: contacts", () => {
  it("keeps the employer's switchboard from its contact page as an organisation number", () => {
    const contactPage = doc("CONTACT", "https://caspian.example/contact", "Caspian Lantern Analytics. General enquiries: +994 12 555 01 00. Press: press@caspian.example");
    const draft = assemble(
      [BIO, contactPage],
      [
        extraction({
          sources: [BIO_SOURCE, source("CONTACT", { about_subject: "unclear", source_type: "company_site", identity_evidence: "Company contact page." })],
          contacts: [
            contact("CONTACT", "+994 12 555 01 00", "General enquiries: +994 12 555 01 00", {
              contact_type: "switchboard",
              belongs_to: "organisation",
              owner_label: "Caspian Lantern Analytics",
              publication_context: "Company contact page",
            }),
          ],
        }),
      ],
    );
    expect(draft.contacts).toEqual([
      expect.objectContaining({
        contactType: "switchboard",
        belongsTo: "organisation",
        isDirect: false,
        value: "+994 12 555 01 00",
        normalisedValue: "+994125550100",
        sourceKey: "CONTACT",
        contactKey: "switchboard:+994125550100",
      }),
    ]);
    expect(draft.gaps.map((g) => g.code)).not.toContain("no_contacts");
  });

  it("does not attach a person-level contact from a page that is not about the subject", () => {
    const contactPage = doc("CONTACT", "https://caspian.example/contact", "Caspian Lantern Analytics. Direct line: +994 12 555 01 77.");
    const draft = assemble(
      [BIO, contactPage],
      [
        extraction({
          sources: [BIO_SOURCE, source("CONTACT", { about_subject: "unclear", source_type: "company_site" })],
          contacts: [contact("CONTACT", "+994 12 555 01 77", "Direct line: +994 12 555 01 77")],
        }),
      ],
    );
    expect(draft.contacts).toEqual([]);
    expect(rejectionsOf(draft, "contact")).toEqual([["identity_not_confirmed", "CONTACT"]]);
  });

  it("shows a reception line attributed to the person as the organisation's switchboard", () => {
    const draft = assemble(
      [BIO],
      [extraction({ sources: [BIO_SOURCE], contacts: [contact("BIO", "+994 12 555 01 00", "Reception: +994 12 555 01 00", { publication_context: "Reception" })] })],
    );
    expect(draft.contacts).toEqual([expect.objectContaining({ contactType: "switchboard", belongsTo: "organisation", isDirect: false })]);
  });

  it("keeps a direct office line from the official bio", () => {
    const draft = assemble([BIO], [extraction({ sources: [BIO_SOURCE], contacts: [contact("BIO", "+994 12 555 01 23", "Office: +994 12 555 01 23")] })]);
    expect(draft.contacts).toEqual([expect.objectContaining({ contactType: "office_line", belongsTo: "person", isDirect: true, note: null })]);
  });

  it("rejects a guessed email that does not appear in the text", () => {
    const draft = assemble(
      [BIO],
      [
        extraction({
          sources: [BIO_SOURCE],
          contacts: [contact("BIO", "elnara.gasimova@caspian.example", "Elnara Gasimova is the Chief Executive Officer", { contact_type: "work_email" })],
        }),
      ],
    );
    expect(draft.contacts).toEqual([]);
    expect(rejectionsOf(draft, "contact")).toEqual([["value_not_in_source", "BIO"]]);
    expect(draft.gaps).toContainEqual({ code: "no_contacts", text: "No public business contact found." });
  });

  it("rejects a personal mobile published on a third-party page", () => {
    const article = doc("ARTICLE", "https://news.example/profile", "Elnara Gasimova, the Caspian Lantern Analytics chief, can be reached on her mobile +994 50 555 77 88.");
    const draft = assemble(
      [article],
      [
        extraction({
          sources: [source("ARTICLE")],
          contacts: [contact("ARTICLE", "+994 50 555 77 88", "can be reached on her mobile +994 50 555 77 88", { contact_type: "business_mobile" })],
        }),
      ],
    );
    expect(draft.contacts).toEqual([]);
    expect(rejectionsOf(draft, "contact")).toEqual([["personal_mobile_not_self_published", "ARTICLE"]]);
  });

  it("deduplicates the same contact and prefers the more reliable source", () => {
    const article = doc("ARTICLE", "https://news.example/profile", "Elnara Gasimova of Caspian Lantern Analytics. Office: +994 (12) 555-01-23.");
    const draft = assemble(
      [article, BIO],
      [
        extraction({
          sources: [source("ARTICLE"), BIO_SOURCE],
          contacts: [contact("ARTICLE", "+994 (12) 555-01-23", "Office: +994 (12) 555-01-23"), contact("BIO", "+994 12 555 01 23", "Office: +994 12 555 01 23")],
        }),
      ],
    );
    expect(draft.contacts).toHaveLength(1);
    expect(draft.contacts[0]).toMatchObject({ sourceKey: "BIO", value: "+994 12 555 01 23" });
  });
});

describe("assembleSnapshot: accounts", () => {
  const LISTING = doc("LISTING", "https://search.example/r/elnara", null, {
    title: "Elnara Gasimova - Chief Executive Officer - Caspian Lantern Analytics",
    snippet: "Elnara Gasimova. Chief Executive Officer at Caspian Lantern Analytics. linkedin.example/in/elnara-gasimova",
  });
  const PROFILE_URL = "https://linkedin.example/in/elnara-gasimova";

  it("keeps an account seen only in a search result as possible", () => {
    const draft = assemble(
      [LISTING],
      [extraction({ sources: [source("LISTING", { source_type: "search_listing" })], accounts: [account("LISTING", PROFILE_URL, "Chief Executive Officer at Caspian Lantern Analytics")] })],
    );
    expect(draft.accounts).toEqual([expect.objectContaining({ status: "possible", discovery: "search_result", platform: "linkedin", handle: "@elnara-gasimova" })]);
    expect(draft.accounts[0].accessNote).toMatch(/requires sign-in/);
    expect(draft.gaps.map((g) => g.code)).toContain("no_accounts");
  });

  it("accepts the same account when the official bio links to it, and keeps one entry", () => {
    const draft = assemble(
      [LISTING, BIO],
      [
        extraction({
          sources: [source("LISTING", { source_type: "search_listing" }), BIO_SOURCE],
          accounts: [
            account("LISTING", PROFILE_URL, "Chief Executive Officer at Caspian Lantern Analytics"),
            account("BIO", `${PROFILE_URL}/`, "Follow her on LinkedIn: linkedin.example/in/elnara-gasimova", { discovery: "linked_from_official_bio" }),
          ],
        }),
      ],
    );
    expect(draft.accounts).toHaveLength(1);
    expect(draft.accounts[0]).toMatchObject({ status: "accepted", discovery: "linked_from_official_bio", sourceKey: "BIO", accountKey: `account|${PROFILE_URL}` });
    expect(draft.accounts[0].matchEvidence.map((e) => e.sourceKey)).toEqual(["LISTING", "BIO"]);
    expect(draft.gaps.map((g) => g.code)).not.toContain("no_accounts");
  });

  it("keeps the accepted account when a later source only finds it in search", () => {
    const draft = assemble(
      [BIO, LISTING],
      [
        extraction({
          sources: [BIO_SOURCE, source("LISTING", { source_type: "search_listing" })],
          accounts: [
            account("BIO", PROFILE_URL, "Follow her on LinkedIn: linkedin.example/in/elnara-gasimova", { discovery: "linked_from_official_bio" }),
            account("LISTING", PROFILE_URL, "Chief Executive Officer at Caspian Lantern Analytics"),
          ],
        }),
      ],
    );
    expect(draft.accounts).toHaveLength(1);
    expect(draft.accounts[0].status).toBe("accepted");
  });

  it("does not accept a claimed bio link that is not actually on the page", () => {
    const draft = assemble(
      [BIO],
      [
        extraction({
          sources: [BIO_SOURCE],
          accounts: [account("BIO", "https://x.example/elnara_g", "Elnara Gasimova is the Chief Executive Officer", { platform: "x", discovery: "linked_from_official_bio" })],
        }),
      ],
    );
    expect(draft.accounts).toEqual([expect.objectContaining({ status: "possible", discovery: "search_result", platform: "x" })]);
  });

  it("rejects account URLs that are not http(s)", () => {
    const draft = assemble(
      [BIO],
      [extraction({ sources: [BIO_SOURCE], accounts: [account("BIO", "javascript:alert(1)", "Elnara Gasimova is the Chief Executive Officer")] })],
    );
    expect(draft.accounts).toEqual([]);
    expect(rejectionsOf(draft, "account")).toEqual([["invalid_url", "BIO"]]);
  });
});

describe("assembleSnapshot: relationships", () => {
  it("labels a shared employer as a shared affiliation that does not establish a relationship", () => {
    const draft = assemble(
      [BIO],
      [
        extraction({
          sources: [BIO_SOURCE],
          relationships: [
            relationship("BIO", "Leyla Huseynova", "Absheron Data Partners, where Leyla Huseynova also worked as an analyst", {
              relation_type: "shared_employer",
              organisation: "Absheron Data Partners",
            }),
          ],
        }),
      ],
    );
    expect(draft.relationships).toEqual([
      expect.objectContaining({ kind: "shared_affiliation", relationType: "shared_employer", label: "Shared employer", counterpartName: "Leyla Huseynova" }),
    ]);
    expect(draft.relationships[0].note).toMatch(/does not establish a direct working or personal relationship/);
    expect(draft.gaps.map((g) => g.code)).toContain("no_connections");
  });

  it("keeps a documented co-founder as documented", () => {
    const draft = assemble(
      [BIO],
      [extraction({ sources: [BIO_SOURCE], relationships: [relationship("BIO", "Rauf Aliyev", "She co-founded the company in 2014 with Rauf Aliyev", { start: "2014" })] })],
    );
    expect(draft.relationships).toEqual([
      expect.objectContaining({ kind: "documented", relationType: "co_founder", label: "Co-founder", note: null, start: expect.objectContaining({ year: 2014 }) }),
    ]);
    expect(draft.relationships[0].sources).toEqual([{ sourceKey: "BIO", excerpt: "She co-founded the company in 2014 with Rauf Aliyev", excerptVerified: true }]);
    expect(draft.gaps.map((g) => g.code)).not.toContain("no_connections");
  });

  it("rejects a relationship whose counterpart is not named in the source", () => {
    const draft = assemble(
      [BIO],
      [extraction({ sources: [BIO_SOURCE], relationships: [relationship("BIO", "Tural Mammadov", "She co-founded the company in 2014")] })],
    );
    expect(draft.relationships).toEqual([]);
    expect(rejectionsOf(draft, "relationship")).toEqual([["counterpart_not_in_source", "BIO"]]);
  });

  it("rejects relationships from sources not confirmed to be about the subject", () => {
    const other = doc("OTHER", "https://art.example/about", "Elnara Gasimova co-founded Sumgayit Art Space with Rauf Aliyev.");
    const draft = assemble(
      [other],
      [extraction({ sources: [source("OTHER", { about_subject: "no" })], relationships: [relationship("OTHER", "Rauf Aliyev", "co-founded Sumgayit Art Space with Rauf Aliyev")] })],
    );
    expect(draft.relationships).toEqual([]);
    expect(rejectionsOf(draft, "relationship")).toEqual([["identity_not_confirmed", "OTHER"]]);
  });
});

describe("assembleSnapshot: media", () => {
  it("marks direct coverage from an unclear source as an unresolved same-name match", () => {
    const blog = doc("BLOG", "https://blog.example/post", "A blogger met Elnara Gasimova at a conference about data and transport.");
    const draft = assemble(
      [blog],
      [extraction({ sources: [source("BLOG", { about_subject: "unclear" })], media: [media("BLOG", "Notes from a data conference", { published_date: "2026-05-01" })] })],
    );
    expect(draft.stories).toHaveLength(1);
    expect(draft.stories[0].coverageType).toBe("unresolved_same_name");
    expect(draft.stories[0].items[0].coverageType).toBe("unresolved_same_name");
    expect(draft.gaps.map((g) => g.code)).toContain("no_direct_news");
  });

  it("drops coverage from a source about someone else unless it is organisation news", () => {
    const painter = doc("PAINTER", "https://art.example/show", "Elnara Gasimova opens a watercolour show in Sumgayit, the gallery said this week.");
    const orgNews = doc("ORG", "https://biz.example/caspian", "Caspian Lantern Analytics opened an office in Tashkent, the company said this week in a statement.");
    const draft = assemble(
      [painter, orgNews],
      [
        extraction({
          sources: [source("PAINTER", { about_subject: "no" }), source("ORG", { about_subject: "no" })],
          media: [
            media("PAINTER", "Watercolours of the Absheron coast on show"),
            media("ORG", "Caspian Lantern Analytics opens Tashkent office", { coverage_type: "organisation", published_date: "2026-02-02" }),
          ],
        }),
      ],
    );
    expect(rejectionsOf(draft, "media")).toEqual([["different_person", "PAINTER"]]);
    expect(draft.stories.map((s) => [s.headline, s.coverageType])).toEqual([["Caspian Lantern Analytics opens Tashkent office", "organisation"]]);
  });

  it("takes the publication date from the page, never from the search provider", () => {
    const dated = doc("DATED", "https://news.example/2024/interview", "An interview with Elnara Gasimova about logistics forecasting and hiring in Baku.", {
      providerPublishedAt: "2026-09-28T00:00:00Z",
    });
    const fromSource = doc("SRCDATE", "https://press.example/release", "Caspian Lantern Analytics, led by Elnara Gasimova, announced a partnership with a port operator.", {
      providerPublishedAt: "2026-09-29T00:00:00Z",
    });
    const undated = doc("UNDATED", "https://video.example/talk", "Video: Elnara Gasimova on public transport data and open standards for cities.", {
      providerPublishedAt: "2026-09-30T12:00:00Z",
    });
    const draft = assemble(
      [dated, fromSource, undated],
      [
        extraction({
          sources: [source("DATED"), source("SRCDATE", { published_date: "2025-11-20" }), source("UNDATED")],
          media: [
            media("DATED", "Interview: forecasting Caspian freight", { kind: "interview", published_date: "2024-05-02" }),
            media("SRCDATE", "Port partnership announced", { kind: "press_release", topic: "business", published_date: "sometime in spring" }),
            media("UNDATED", "Talk on transport data", { kind: "video", topic: "event" }),
          ],
        }),
      ],
    );
    const items = Object.fromEntries(draft.stories.flatMap((s) => s.items).map((i) => [i.sourceKey, i]));
    expect(items.DATED).toMatchObject({ publishedAt: "2024-05-02", publishedPrecision: "day", providerReportedDate: null });
    expect(items.SRCDATE).toMatchObject({ publishedAt: "2025-11-20", providerReportedDate: null });
    expect(items.UNDATED).toMatchObject({ publishedAt: null, publishedPrecision: null, providerReportedDate: "2026-09-30" });
  });

  it("groups syndicated copies into one story with a single primary item", () => {
    const wire = doc("WIRE", "https://wire.example/caspian", WIRE_TEXT);
    const copy = doc("COPY", "https://daily.example/biz/caspian", `${WIRE_TEXT} Reporting by staff.`);
    const draft = assemble(
      [copy, wire],
      [
        extraction({
          sources: [source("COPY"), source("WIRE")],
          media: [
            media("COPY", "Baku start-up Caspian Lantern secures $4m", { outlet: "Daily", published_date: "2026-03-11" }),
            media("WIRE", "Caspian Lantern Analytics raises $4m", { outlet: "Wire", published_date: "2026-03-10" }),
          ],
        }),
      ],
    );
    expect(draft.stories).toHaveLength(1);
    const [story] = draft.stories;
    expect(story.items).toHaveLength(2);
    expect(story.items.filter((i) => i.isPrimary)).toHaveLength(1);
    expect(story.items[0]).toMatchObject({ isPrimary: true, sourceKey: "WIRE" });
    expect(story).toMatchObject({ headline: "Caspian Lantern Analytics raises $4m", firstPublishedAt: "2026-03-10", coverageType: "direct" });
    expect(story.items.map((i) => i.tempId)).toEqual(["M1", "M2"]);
  });

  it("marks summaries of snippet-only documents as snippet based", () => {
    const paywalled = doc("PAY", "https://paper.example/premium/gasimova", null, {
      accessStatus: "paywalled",
      title: "Elnara Gasimova on the next funding round",
      snippet: "Elnara Gasimova, chief executive of Caspian Lantern Analytics, told the paper about plans for the next funding round.",
    });
    const draft = assemble([paywalled], [extraction({ sources: [source("PAY")], media: [media("PAY", "Elnara Gasimova on the next funding round", { published_date: "2026-08-01" })] })]);
    expect(draft.stories[0].items[0].summaryBasis).toBe("snippet_only");
    expect(draft.accessLimitations).toEqual([
      { domain: "paper.example", url: "https://paper.example/premium/gasimova", status: "paywalled", note: "Paywalled; only the search snippet was used." },
    ]);
  });

  it("gives every story a unique key, even when distinct stories share a headline and date", () => {
    // Same headline and date, different languages, no shared text: two stories, not one.
    const en = doc("EN", "https://en.example/elnara", "Elnara Gasimova spoke about hiring plans at the company this spring in Baku.");
    const az = doc("AZ", "https://az.example/elnara", "Elnara Gasimova şirkətin yeni ofisi haqqında danışdı və gələcək planları açıqladı.");
    const draft = assemble(
      [en, az],
      [
        extraction({
          sources: [source("EN"), source("AZ", { page_language: "az" })],
          media: [
            media("EN", "Elnara Gasimova", { kind: "video", published_date: null }),
            media("AZ", "Elnara Gasimova", { kind: "video", published_date: null, language: "az" }),
          ],
        }),
      ],
    );
    expect(draft.stories).toHaveLength(2);
    expect(new Set(draft.stories.map((s) => s.storyKey)).size).toBe(2);
    expect(draft.stories[0].storyKey).toBe("story|elnara-gasimova|undated");
  });

  it("uses full text as the summary basis for read pages", () => {
    const wire = doc("WIRE", "https://wire.example/caspian", WIRE_TEXT);
    const draft = assemble([wire], [extraction({ sources: [source("WIRE")], media: [media("WIRE", "Caspian Lantern Analytics raises $4m")] })]);
    expect(draft.stories[0].items[0].summaryBasis).toBe("full_text");
  });
});

describe("assembleSnapshot: sources, limitations and gaps", () => {
  it("reports neutral gaps when nothing was found", () => {
    const draft = assemble([], []);
    expect(draft.gaps.map((g) => g.text)).toEqual([
      "No published education history was found.",
      "No public business contact found.",
      "No public social account could be confirmed from an official or self-published link.",
      "No documented professional relationships were found.",
      "No news coverage directly about this person was found.",
      "No professional role could be evidenced.",
    ]);
  });

  it("adds a gap for each failed search category", () => {
    const coverage: CoverageEntry[] = [
      { category: "career", status: "ok", queries: 3, results: 12, note: null },
      { category: "news", status: "failed", queries: 2, results: 0, note: "The search provider timed out." },
      { category: "contacts", status: "partial", queries: 1, results: 1, note: null },
    ];
    const draft = assemble([], [], { coverage });
    expect(draft.gaps.filter((g) => g.code.startsWith("search_failed"))).toEqual([
      { code: "search_failed_news", text: "The news search did not complete (The search provider timed out.); this section may be incomplete." },
    ]);
    expect(draft.coverage).toBe(coverage);
  });

  it("notes that the latest role is not confirmed as current", () => {
    const draft = assemble(
      [BIO],
      [extraction({ sources: [BIO_SOURCE], facts: [fact("BIO", "Elnara Gasimova is the Chief Executive Officer of Caspian Lantern Analytics")] })],
    );
    expect(draft.headline.roleConfirmedCurrent).toBe(false);
    expect(draft.gaps.map((g) => g.code)).toContain("role_not_current");
  });

  it("lists every retrieved document with what happened to it", () => {
    const other = doc("OTHER", "https://art.example/elnara", "Elnara Gasimova is a painter in Sumgayit.", { snippet: "Painter." });
    const login = doc("LI", "https://linkedin.example/in/elnara-gasimova", null, { accessStatus: "login_required", title: "Elnara Gasimova | LinkedIn" });
    const draft = assemble(
      [BIO, other, login],
      [extraction({ sources: [BIO_SOURCE, source("OTHER", { about_subject: "no", source_type: "personal_site", published_date: "2025-02" })] })],
      { analysedKeys: ["BIO", "OTHER"], blocked: [{ url: "https://people-lookup.example/elnara", reason: "People-search site (blocked by policy)." }] },
    );
    expect(draft.sources.map((s) => [s.key, s.aboutSubject, s.sourceType, s.reliability])).toEqual([
      ["BIO", "yes", "official_bio", "official"],
      ["OTHER", "no", "personal_site", "self_published"],
      ["LI", "unclear", "other", "unknown"],
    ]);
    const otherSource = draft.sources.find((s) => s.key === "OTHER")!;
    expect(otherSource.excerpt).toBeNull();
    expect(otherSource).toMatchObject({ publishedAt: "2025-02", publishedPrecision: "month" });
    expect(draft.sources.find((s) => s.key === "BIO")!.excerpt).toMatch(/^Elnara Gasimova is the Chief Executive Officer/);
    expect(draft.sources.find((s) => s.key === "LI")!.accessNote).toBe("Retrieved but not analysed.");
    expect(draft.accessLimitations).toEqual([
      { domain: "linkedin.example", url: "https://linkedin.example/in/elnara-gasimova", status: "login_required", note: "Requires sign-in; not accessed." },
      { domain: "people-lookup.example", url: null, status: "blocked", note: "People-search site (blocked by policy)." },
    ]);
  });
});
