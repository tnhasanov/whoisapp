import { describe, expect, it } from "vitest";
import type { Temporal } from "@/lib/domain/types";
import {
  baseClaimKey,
  classifyPublication,
  diffSnapshots,
  type DiffAccount,
  type DiffClaim,
  type DiffContact,
  type DiffMedia,
  type DiffSide,
} from "@/lib/diff/snapshot-diff";

const PREVIOUS = "2026-03-15T09:30:00Z";
const TODAY = "2026-10-01T09:00:00Z";

const temporal = (overrides: Partial<Temporal> = {}): Temporal => ({
  start: null,
  end: null,
  currency: "unknown",
  asOf: null,
  possiblyOutdated: false,
  ...overrides,
});

function claim(id: string, overrides: Partial<DiffClaim> = {}): DiffClaim {
  return {
    id,
    claimKey: "employment|caspian-lantern-analytics|chief-executive-officer",
    category: "employment",
    displayValue: "Chief Executive Officer, Caspian Lantern Analytics",
    evidenceStatus: "official_source",
    conflictGroup: null,
    temporal: temporal({ start: { year: 2014 }, currency: "stated_current", asOf: "2026-03-01" }),
    ...overrides,
  };
}

const media = (id: string, overrides: Partial<DiffMedia> = {}): DiffMedia => ({
  id,
  canonicalUrl: `https://news.example/${id}`,
  headline: `Headline ${id}`,
  outlet: "News",
  publishedAt: "2026-01-10",
  coverageType: "direct",
  ...overrides,
});
const contact = (id: string, key: string): DiffContact => ({ id, contactKey: key, contactType: "switchboard", value: key });
const account = (id: string, status: DiffAccount["status"], url = "https://linkedin.example/in/elnara"): DiffAccount => ({
  id,
  accountKey: `account|${url}`,
  platform: "linkedin",
  url,
  status,
});

function side(version: number, researchedAt: string, overrides: Partial<DiffSide> = {}): DiffSide {
  return {
    version,
    researchedAt,
    claims: [],
    media: [],
    contacts: [],
    accounts: [],
    relationships: [],
    headline: { role: "Chief Executive Officer", organisation: "Caspian Lantern Analytics", location: "Baku" },
    ...overrides,
  };
}

describe("classifyPublication", () => {
  it("calls an old article found today 'old' (newly discovered, not a new event)", () => {
    expect(classifyPublication("2025-01-01", PREVIOUS)).toBe("old");
    expect(classifyPublication("2026-03-14", PREVIOUS)).toBe("old");
    expect(classifyPublication("2025", PREVIOUS)).toBe("old");
  });

  it("calls items published on or after the previous research date 'new'", () => {
    expect(classifyPublication("2026-03-15", PREVIOUS)).toBe("new");
    expect(classifyPublication("2026-09-30", PREVIOUS)).toBe("new");
    expect(classifyPublication("2026-04", PREVIOUS)).toBe("new");
  });

  it("is uncertain when the date is too coarse to compare", () => {
    expect(classifyPublication("2026", PREVIOUS)).toBe("uncertain");
    expect(classifyPublication("2026-03", PREVIOUS)).toBe("uncertain");
  });

  it("is uncertain when the date is unknown or invalid", () => {
    expect(classifyPublication(null, PREVIOUS)).toBe("uncertain");
    expect(classifyPublication("last week", PREVIOUS)).toBe("uncertain");
  });
});

describe("baseClaimKey", () => {
  it("uses the conflict group for conflicting claims", () => {
    expect(baseClaimKey({ claimKey: "employment|x|ceo|2014", conflictGroup: "conflict:employment|x|ceo" })).toBe("employment|x|ceo");
    expect(baseClaimKey({ claimKey: "employment|x|ceo", conflictGroup: null })).toBe("employment|x|ceo");
  });
});

describe("diffSnapshots", () => {
  it("reports no changes for identical sides", () => {
    const content = {
      claims: [claim("C1")],
      media: [media("m1")],
      contacts: [contact("k1", "switchboard:+994125550123")],
      accounts: [account("a1", "accepted")],
      relationships: [{ id: "r1", relationshipKey: "relationship|co_founder|rauf|x", label: "Co-founder", counterpartName: "Rauf", kind: "documented" }],
    };
    const diff = diffSnapshots(side(1, PREVIOUS, content), side(2, TODAY, content));
    expect(diff.hasChanges).toBe(false);
    expect(diff.unchanged).toEqual({ claims: 1, media: 1 });
    expect(diff.claims).toEqual({ added: [], removed: [], updated: [], conflictsResolved: [], conflictsIntroduced: [] });
    expect(diff.from).toEqual({ version: 1, researchedAt: PREVIOUS });
    expect(diff.to).toEqual({ version: 2, researchedAt: TODAY });
  });

  it("classifies newly found media by original publication date", () => {
    const older = side(1, PREVIOUS, { media: [media("kept"), media("gone")] });
    const newer = side(2, TODAY, {
      media: [
        media("kept"),
        media("old-article", { publishedAt: "2024-05-02" }),
        media("fresh", { publishedAt: "2026-06-01" }),
        media("vague", { publishedAt: "2026" }),
        media("undated", { publishedAt: null }),
      ],
    });
    const diff = diffSnapshots(older, newer);
    expect(diff.media.newlyDiscovered.map((m) => m.id)).toEqual(["old-article"]);
    expect(diff.media.newlyPublished.map((m) => m.id)).toEqual(["fresh"]);
    expect(diff.media.dateUncertain.map((m) => m.id)).toEqual(["vague", "undated"]);
    expect(diff.media.noLongerFound.map((m) => m.id)).toEqual(["gone"]);
    expect(diff.unchanged.media).toBe(1);
    expect(diff.hasChanges).toBe(true);
  });

  it("reports added and removed claims", () => {
    const education = claim("E1", { claimKey: "education|ada-university|master", category: "education", displayValue: "MSc, ADA University" });
    const location = claim("L1", { claimKey: "location|baku", category: "location", displayValue: "Baku" });
    const diff = diffSnapshots(side(1, PREVIOUS, { claims: [claim("C1"), location] }), side(2, TODAY, { claims: [claim("C2"), education] }));
    expect(diff.claims.added.map((c) => c.id)).toEqual(["E1"]);
    expect(diff.claims.removed.map((c) => c.id)).toEqual(["L1"]);
    expect(diff.unchanged.claims).toBe(1);
  });

  it("reports updated claims with the kinds of change", () => {
    const before = claim("C1");
    const after = claim("C2", {
      displayValue: "CEO and Co-founder, Caspian Lantern Analytics",
      evidenceStatus: "multiple_sources",
      temporal: temporal({ start: { year: 2014, month: 6 }, currency: "stated_current", asOf: "2026-09-30" }),
    });
    const diff = diffSnapshots(side(1, PREVIOUS, { claims: [before] }), side(2, TODAY, { claims: [after] }));
    expect(diff.claims.updated).toEqual([{ before, after, changes: ["dates", "evidence", "wording"] }]);
  });

  it("reports a currency change when a role becomes possibly outdated or ended", () => {
    const outdated = claim("C2", { temporal: temporal({ start: { year: 2014 }, currency: "stated_current", asOf: "2026-03-01", possiblyOutdated: true }) });
    expect(diffSnapshots(side(1, PREVIOUS, { claims: [claim("C1")] }), side(2, TODAY, { claims: [outdated] })).claims.updated[0].changes).toEqual([
      "currency",
    ]);
    const ended = claim("C3", { temporal: temporal({ start: { year: 2014 }, end: { year: 2026 }, currency: "ended" }) });
    expect(diffSnapshots(side(1, PREVIOUS, { claims: [claim("C1")] }), side(2, TODAY, { claims: [ended] })).claims.updated[0].changes).toEqual([
      "dates",
      "currency",
    ]);
  });

  it("reports a resolved conflict when the conflict group disappears", () => {
    const group = "conflict:employment|caspian-lantern-analytics|chief-executive-officer";
    const before = [
      claim("C1", { claimKey: `${group.slice(9)}|2014`, conflictGroup: group, evidenceStatus: "conflicting" }),
      claim("C2", { claimKey: `${group.slice(9)}|2015`, conflictGroup: group, evidenceStatus: "conflicting" }),
    ];
    const after = [claim("C3", { evidenceStatus: "multiple_sources" })];
    const diff = diffSnapshots(side(1, PREVIOUS, { claims: before }), side(2, TODAY, { claims: after }));
    expect(diff.claims.conflictsResolved).toEqual([{ key: "employment|caspian-lantern-analytics|chief-executive-officer", before, after }]);
    expect(diff.claims.added).toEqual([]);
    expect(diff.claims.removed).toEqual([]);
    expect(diff.hasChanges).toBe(true);
  });

  it("reports a newly introduced conflict", () => {
    const group = "conflict:employment|caspian-lantern-analytics|chief-executive-officer";
    const after = [
      claim("C2", { claimKey: `${group.slice(9)}|2014`, conflictGroup: group, evidenceStatus: "conflicting" }),
      claim("C3", { claimKey: `${group.slice(9)}|2015`, conflictGroup: group, evidenceStatus: "conflicting" }),
    ];
    const diff = diffSnapshots(side(1, PREVIOUS, { claims: [claim("C1")] }), side(2, TODAY, { claims: after }));
    expect(diff.claims.conflictsIntroduced).toEqual([{ key: "employment|caspian-lantern-analytics|chief-executive-officer", after }]);
    expect(diff.claims.updated).toEqual([]);
  });

  it("reports accounts promoted from possible to accepted (and demoted)", () => {
    const diff = diffSnapshots(
      side(1, PREVIOUS, { accounts: [account("a1", "possible"), account("x1", "accepted", "https://x.example/elnara")] }),
      side(2, TODAY, { accounts: [account("a2", "accepted"), account("x2", "possible", "https://x.example/elnara")] }),
    );
    expect(diff.accounts.promoted.map((a) => a.id)).toEqual(["a2"]);
    expect(diff.accounts.demoted.map((a) => a.id)).toEqual(["x2"]);
    expect(diff.accounts.added).toEqual([]);
    expect(diff.accounts.removed).toEqual([]);
    expect(diff.hasChanges).toBe(true);
  });

  it("reports contacts and relationships added and removed", () => {
    const rel = (id: string, key: string) => ({ id, relationshipKey: key, label: "Co-founder", counterpartName: key, kind: "documented" });
    const diff = diffSnapshots(
      side(1, PREVIOUS, { contacts: [contact("k1", "switchboard:+994125550123")], relationships: [rel("r1", "old")] }),
      side(2, TODAY, { contacts: [contact("k2", "work_email:elnara@caspian.example")], relationships: [rel("r2", "new")] }),
    );
    expect(diff.contacts.added.map((c) => c.contactKey)).toEqual(["work_email:elnara@caspian.example"]);
    expect(diff.contacts.removed.map((c) => c.contactKey)).toEqual(["switchboard:+994125550123"]);
    expect(diff.relationships.added.map((r) => r.id)).toEqual(["r2"]);
    expect(diff.relationships.removed.map((r) => r.id)).toEqual(["r1"]);
    expect(diff.hasChanges).toBe(true);
  });

  it("reports a headline change", () => {
    const diff = diffSnapshots(
      side(1, PREVIOUS),
      side(2, TODAY, { headline: { role: "Chair of the Board", organisation: "Caspian Lantern Analytics", location: "Baku" } }),
    );
    expect(diff.headline.changed).toBe(true);
    expect(diff.headline.after.role).toBe("Chair of the Board");
    expect(diff.hasChanges).toBe(true);
  });
});
