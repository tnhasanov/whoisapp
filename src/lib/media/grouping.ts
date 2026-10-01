import { normaliseForMatch } from "@/lib/research/text";

/**
 * Groups syndicated or duplicated coverage into stories. Copies of one story
 * are shown together with alternate links and are never counted as
 * independent corroboration.
 */

export type GroupableItem = {
  key: string;
  canonicalUrl: string;
  headline: string;
  language: string;
  publishedAt: string | null;
  /** Article text (or snippet) used for near-duplicate detection. */
  text: string;
};

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "for", "to", "and", "as", "at", "by", "with", "its", "is",
  "və", "ilə", "üçün", "bir", "в", "и", "на", "с", "по", "для", "из", "о",
]);

function headlineTokens(headline: string): Set<string> {
  return new Set(
    normaliseForMatch(headline)
      .replace(/[^\p{L}\p{N}\s$%]/gu, " ")
      .split(/\s+/)
      .filter((t) => t && !STOPWORDS.has(t)),
  );
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function shingles(text: string, size = 5): Set<string> {
  const words = normaliseForMatch(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(" "));
  return out;
}

function daysApart(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = Date.parse(a.length === 4 ? `${a}-07-01` : a.length === 7 ? `${a}-15` : a);
  const db = Date.parse(b.length === 4 ? `${b}-07-01` : b.length === 7 ? `${b}-15` : b);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.abs(da - db) / 86_400_000;
}

export const HEADLINE_THRESHOLD = 0.6;
export const TEXT_THRESHOLD = 0.5;

export function isSameStory(a: GroupableItem, b: GroupableItem): boolean {
  if (a.canonicalUrl === b.canonicalUrl) return true;
  const gap = daysApart(a.publishedAt, b.publishedAt);
  if (gap !== null && gap > 7) return false;
  const textA = shingles(a.text);
  const textB = shingles(b.text);
  if (textA.size >= 8 && textB.size >= 8 && jaccard(textA, textB) >= TEXT_THRESHOLD) return true;
  if (a.language === b.language && jaccard(headlineTokens(a.headline), headlineTokens(b.headline)) >= HEADLINE_THRESHOLD) {
    return true;
  }
  return false;
}

/** Union-find grouping; returns groups of item keys in input order. */
export function groupStories(items: GroupableItem[]): string[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (isSameStory(items[i], items[j])) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, string[]>();
  items.forEach((item, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(item.key);
  });
  return [...groups.values()];
}

/**
 * Near-duplicate detection between retrieved documents (syndication), used
 * when counting independent corroboration. Text overlap only: similar titles
 * alone (e.g. two bios with the person's name) are not syndication.
 */
export function syndicationGroups(docs: { key: string; text: string }[]): Map<string, string> {
  const sets = docs.map((d) => shingles(d.text));
  const parent = docs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      if (sets[i].size >= 8 && sets[j].size >= 8 && jaccard(sets[i], sets[j]) >= TEXT_THRESHOLD) parent[find(j)] = find(i);
    }
  }
  const members = new Map<number, string[]>();
  docs.forEach((d, i) => {
    const root = find(i);
    if (!members.has(root)) members.set(root, []);
    members.get(root)!.push(d.key);
  });
  const result = new Map<string, string>();
  for (const group of members.values()) {
    if (group.length < 2) continue;
    for (const key of group) result.set(key, `syn:${group[0]}`);
  }
  return result;
}
