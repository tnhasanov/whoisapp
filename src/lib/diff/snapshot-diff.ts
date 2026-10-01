import { parsePartialDate, partialDateEnd, partialDateStart, partialDateToString } from "@/lib/dates/partial-date";
import type { AccountStatus, ClaimCategory, Temporal } from "@/lib/domain/types";

/**
 * "What changed?" between two snapshots of the same profile.
 *
 * Coverage is classified by its ORIGINAL publication date relative to the
 * previous research date: an old article found today is "newly discovered",
 * not a new event. Items whose date is unknown or too coarse to compare are
 * reported separately rather than guessed.
 */

export type DiffClaim = {
  id: string;
  claimKey: string;
  category: ClaimCategory;
  displayValue: string;
  evidenceStatus: string;
  conflictGroup: string | null;
  temporal: Temporal;
};

export type DiffMedia = { id: string; canonicalUrl: string; headline: string; outlet: string; publishedAt: string | null; coverageType: string };
export type DiffContact = { id: string; contactKey: string; contactType: string; value: string };
export type DiffAccount = { id: string; accountKey: string; platform: string; url: string; status: AccountStatus };
export type DiffRelationship = { id: string; relationshipKey: string; label: string; counterpartName: string; kind: string };

export type DiffSide = {
  version: number;
  researchedAt: string;
  claims: DiffClaim[];
  media: DiffMedia[];
  contacts: DiffContact[];
  accounts: DiffAccount[];
  relationships: DiffRelationship[];
  headline: { role: string | null; organisation: string | null; location: string | null };
};

export type ClaimChange = { before: DiffClaim; after: DiffClaim; changes: ("dates" | "currency" | "evidence" | "wording")[] };

export type SnapshotDiff = {
  from: { version: number; researchedAt: string };
  to: { version: number; researchedAt: string };
  headline: { changed: boolean; before: DiffSide["headline"]; after: DiffSide["headline"] };
  media: {
    newlyPublished: DiffMedia[];
    newlyDiscovered: DiffMedia[];
    dateUncertain: DiffMedia[];
    noLongerFound: DiffMedia[];
  };
  claims: {
    added: DiffClaim[];
    removed: DiffClaim[];
    updated: ClaimChange[];
    conflictsResolved: { key: string; before: DiffClaim[]; after: DiffClaim[] }[];
    conflictsIntroduced: { key: string; after: DiffClaim[] }[];
  };
  contacts: { added: DiffContact[]; removed: DiffContact[] };
  accounts: { added: DiffAccount[]; removed: DiffAccount[]; promoted: DiffAccount[]; demoted: DiffAccount[] };
  relationships: { added: DiffRelationship[]; removed: DiffRelationship[] };
  unchanged: { claims: number; media: number };
  hasChanges: boolean;
};

export function baseClaimKey(c: Pick<DiffClaim, "claimKey" | "conflictGroup">): string {
  return c.conflictGroup ? c.conflictGroup.replace(/^conflict:/, "") : c.claimKey;
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

function temporalSignature(t: Temporal): string {
  return `${partialDateToString(t.start) ?? ""}|${partialDateToString(t.end) ?? ""}`;
}

export function classifyPublication(publishedAt: string | null, previousResearchedAt: string): "new" | "old" | "uncertain" {
  const date = parsePartialDate(publishedAt);
  if (!date) return "uncertain";
  const previous = new Date(previousResearchedAt);
  const previousDayStart = new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth(), previous.getUTCDate()));
  if (partialDateStart(date) >= previousDayStart) return "new";
  if (partialDateEnd(date) < previousDayStart) return "old";
  return "uncertain";
}

export function diffSnapshots(older: DiffSide, newer: DiffSide): SnapshotDiff {
  // Media
  const olderUrls = new Set(older.media.map((m) => m.canonicalUrl));
  const newerUrls = new Set(newer.media.map((m) => m.canonicalUrl));
  const addedMedia = newer.media.filter((m) => !olderUrls.has(m.canonicalUrl));
  const media = {
    newlyPublished: addedMedia.filter((m) => classifyPublication(m.publishedAt, older.researchedAt) === "new"),
    newlyDiscovered: addedMedia.filter((m) => classifyPublication(m.publishedAt, older.researchedAt) === "old"),
    dateUncertain: addedMedia.filter((m) => classifyPublication(m.publishedAt, older.researchedAt) === "uncertain"),
    noLongerFound: older.media.filter((m) => !newerUrls.has(m.canonicalUrl)),
  };

  // Claims by base key
  const olderByKey = groupBy(older.claims, baseClaimKey);
  const newerByKey = groupBy(newer.claims, baseClaimKey);
  const added: DiffClaim[] = [];
  const removed: DiffClaim[] = [];
  const updated: ClaimChange[] = [];
  const conflictsResolved: SnapshotDiff["claims"]["conflictsResolved"] = [];
  const conflictsIntroduced: SnapshotDiff["claims"]["conflictsIntroduced"] = [];
  let unchangedClaims = 0;

  for (const [key, after] of newerByKey) {
    const before = olderByKey.get(key);
    if (!before) {
      added.push(...after);
      continue;
    }
    const beforeConflict = before.some((c) => c.conflictGroup);
    const afterConflict = after.some((c) => c.conflictGroup);
    if (beforeConflict && !afterConflict) {
      conflictsResolved.push({ key, before, after });
      continue;
    }
    if (!beforeConflict && afterConflict) {
      conflictsIntroduced.push({ key, after });
      continue;
    }
    if (before.length === 1 && after.length === 1) {
      const b = before[0];
      const a = after[0];
      const changes: ClaimChange["changes"] = [];
      if (temporalSignature(b.temporal) !== temporalSignature(a.temporal)) changes.push("dates");
      if (b.temporal.currency !== a.temporal.currency || b.temporal.possiblyOutdated !== a.temporal.possiblyOutdated) changes.push("currency");
      if (b.evidenceStatus !== a.evidenceStatus) changes.push("evidence");
      if (b.displayValue !== a.displayValue) changes.push("wording");
      if (changes.length > 0) updated.push({ before: b, after: a, changes });
      else unchangedClaims++;
    } else {
      unchangedClaims++;
    }
  }
  for (const [key, before] of olderByKey) {
    if (!newerByKey.has(key)) removed.push(...before);
  }

  // Contacts, accounts, relationships
  const keyed = <T, K extends string>(items: T[], key: (t: T) => K) => new Map(items.map((i) => [key(i), i]));
  const olderContacts = keyed(older.contacts, (c) => c.contactKey);
  const newerContacts = keyed(newer.contacts, (c) => c.contactKey);
  const olderAccounts = keyed(older.accounts, (a) => a.accountKey);
  const newerAccounts = keyed(newer.accounts, (a) => a.accountKey);
  const olderRels = keyed(older.relationships, (r) => r.relationshipKey);
  const newerRels = keyed(newer.relationships, (r) => r.relationshipKey);

  const accounts = {
    added: [...newerAccounts.values()].filter((a) => !olderAccounts.has(a.accountKey)),
    removed: [...olderAccounts.values()].filter((a) => !newerAccounts.has(a.accountKey)),
    promoted: [...newerAccounts.values()].filter((a) => olderAccounts.get(a.accountKey)?.status === "possible" && a.status === "accepted"),
    demoted: [...newerAccounts.values()].filter((a) => olderAccounts.get(a.accountKey)?.status === "accepted" && a.status === "possible"),
  };
  const contacts = {
    added: [...newerContacts.values()].filter((c) => !olderContacts.has(c.contactKey)),
    removed: [...olderContacts.values()].filter((c) => !newerContacts.has(c.contactKey)),
  };
  const relationships = {
    added: [...newerRels.values()].filter((r) => !olderRels.has(r.relationshipKey)),
    removed: [...olderRels.values()].filter((r) => !newerRels.has(r.relationshipKey)),
  };
  const headlineChanged =
    older.headline.role !== newer.headline.role || older.headline.organisation !== newer.headline.organisation || older.headline.location !== newer.headline.location;

  const result: SnapshotDiff = {
    from: { version: older.version, researchedAt: older.researchedAt },
    to: { version: newer.version, researchedAt: newer.researchedAt },
    headline: { changed: headlineChanged, before: older.headline, after: newer.headline },
    media,
    claims: { added, removed, updated, conflictsResolved, conflictsIntroduced },
    contacts,
    accounts,
    relationships,
    unchanged: { claims: unchangedClaims, media: newer.media.length - addedMedia.length },
    hasChanges: false,
  };
  result.hasChanges =
    headlineChanged ||
    Object.values(media).some((l) => l.length > 0) ||
    added.length + removed.length + updated.length + conflictsResolved.length + conflictsIntroduced.length > 0 ||
    contacts.added.length + contacts.removed.length > 0 ||
    Object.values(accounts).some((l) => l.length > 0) ||
    relationships.added.length + relationships.removed.length > 0;
  return result;
}
