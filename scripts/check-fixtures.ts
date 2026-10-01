/**
 * Validates the fictional demo world. Run with `npm run fixtures:check`.
 *
 * Guarantees that fixtures stay obviously fictional (reserved domains, drama
 * phone ranges) and internally consistent with the real verification rules
 * (verbatim excerpts, contact values present in the source text, selectors
 * that resolve), so the demo exercises the genuine pipeline checks.
 */
import type { FixtureDocExtraction, FixtureDocument, FixturePersonBundle } from "@/fixtures/types";
import {
  FIXTURE_BUNDLES,
  FIXTURE_EXAMPLES,
  allFixtureDocuments,
  fixtureDocumentsForVersion,
} from "@/fixtures/world";
import { isValidPartialDateString } from "@/lib/dates/partial-date";
import { queryMentionsName } from "@/lib/names";
import { contactValueAppearsIn, digitsOnly, excerptAppearsIn, normaliseForMatch } from "@/lib/research/text";

const errors: string[] = [];
const warnings: string[] = [];
const err = (msg: string) => errors.push(msg);

const RESERVED_HOST = /(^|\.)example(\.com|\.org|\.net)?$/i;

function isReservedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && RESERVED_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

function isFictionalPhone(digits: string): boolean {
  // UK Ofcom drama ranges: 020 7946 0000-0999 and 07700 900000-900999.
  if (/^(44)?0?2079460\d{3}$/.test(digits)) return true;
  if (/^(44)?0?7700900\d{3}$/.test(digits)) return true;
  // North American fictional range: NXX-555-0100..0199.
  if (/^1?\d{3}55501\d{2}$/.test(digits)) return true;
  return false;
}

function docText(doc: FixtureDocument): string {
  return [doc.title, doc.snippet, doc.body ?? ""].join("\n");
}

function checkDocument(doc: FixtureDocument) {
  const where = `doc ${doc.key}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(doc.key)) err(`${where}: key must be kebab-case`);
  if (!isReservedUrl(doc.url)) err(`${where}: url must be https on a reserved example domain (${doc.url})`);
  if (!doc.title.trim()) err(`${where}: empty title`);
  if (!doc.publisher.trim()) err(`${where}: empty publisher`);
  if (doc.snippet.length > 320) err(`${where}: snippet longer than 320 chars`);
  if (doc.access === "read" && !doc.body?.trim()) err(`${where}: access "read" requires a body`);
  if (doc.access !== "read" && doc.body !== null) err(`${where}: access "${doc.access}" must have body null`);
  if (doc.publishedDate === "@run-date") {
    if (JSON.stringify(doc.versions) !== JSON.stringify([2])) err(`${where}: "@run-date" only allowed on version-2-only documents`);
  } else if (!isValidPartialDateString(doc.publishedDate)) {
    err(`${where}: invalid publishedDate ${doc.publishedDate}`);
  }
  if (doc.providerPublishedDate && !isValidPartialDateString(doc.providerPublishedDate.slice(0, 10))) {
    err(`${where}: invalid providerPublishedDate`);
  }
  if (doc.categories.length === 0) err(`${where}: no categories`);
  const text = normaliseForMatch(docText(doc));
  for (const form of doc.nameForms) {
    if (!text.includes(normaliseForMatch(form))) err(`${where}: nameForm "${form}" does not appear in title/snippet/body`);
  }
  // Every email must use a reserved domain.
  for (const email of docText(doc).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
    const host = email.split("@")[1];
    if (!RESERVED_HOST.test(host)) err(`${where}: email ${email} is not on a reserved domain`);
  }
  // Every phone-like number must be in a fictional range.
  for (const run of docText(doc).match(/\+?\(?\d[\d\s().-]{7,}\d/g) ?? []) {
    const digits = digitsOnly(run);
    if (digits.length < 9 || /^(19|20)\d{2}$/.test(digits)) continue;
    if (/^\d{4}[-\s]\d{2}[-\s]\d{2}$/.test(run.trim())) continue; // ISO dates
    if (!isFictionalPhone(digits)) err(`${where}: number "${run.trim()}" is not in a reserved fictional range`);
  }
}

function checkExtraction(bundle: FixturePersonBundle, docKey: string, ex: FixtureDocExtraction, docs: Map<string, FixtureDocument>) {
  const where = `${bundle.person.key} extraction ${docKey}`;
  const doc = docs.get(docKey);
  if (!doc) {
    err(`${where}: unknown document`);
    return;
  }
  const text = doc.body ?? `${doc.title}\n${doc.snippet}`;
  const checkExcerpt = (label: string, excerpt: string) => {
    if (excerpt.length > 400) err(`${where}: ${label} excerpt longer than 400 chars`);
    if (!excerptAppearsIn(excerpt, text)) err(`${where}: ${label} excerpt not found verbatim: "${excerpt.slice(0, 90)}"`);
  };
  if (!isValidPartialDateString(ex.source.published_date) && ex.source.published_date !== "@run-date") {
    err(`${where}: invalid source.published_date`);
  }
  for (const [i, f] of (ex.facts ?? []).entries()) {
    checkExcerpt(`fact[${i}]`, f.supporting_excerpt);
    if (!isValidPartialDateString(f.start) || !isValidPartialDateString(f.end)) err(`${where}: fact[${i}] invalid start/end`);
    const required: Record<string, unknown> = {
      employment: f.organisation,
      education: f.institution,
      affiliation: f.organisation,
      location: f.place,
      biography: f.statement,
      award: f.award_name,
      publication: f.publication_title,
    };
    if (!required[f.category]) err(`${where}: fact[${i}] (${f.category}) missing its main field`);
  }
  for (const [i, c] of (ex.contacts ?? []).entries()) {
    checkExcerpt(`contact[${i}]`, c.supporting_excerpt);
    if (!contactValueAppearsIn(c.value, text)) err(`${where}: contact[${i}] value "${c.value}" not present in source text`);
    if (c.contact_type === "switchboard" && c.belongs_to === "person") err(`${where}: contact[${i}] switchboard cannot belong to the person`);
  }
  for (const [i, a] of (ex.accounts ?? []).entries()) {
    checkExcerpt(`account[${i}]`, a.supporting_excerpt);
    if (!/^https:\/\//.test(a.url)) err(`${where}: account[${i}] url must be https`);
    if (a.discovery.startsWith("linked_from") && !normaliseForMatch(text).includes(normaliseForMatch(a.url.replace(/^https:\/\//, "")))) {
      err(`${where}: account[${i}] url not present on the linking page`);
    }
  }
  for (const [i, r] of (ex.relationships ?? []).entries()) {
    checkExcerpt(`relationship[${i}]`, r.supporting_excerpt);
    if (!isValidPartialDateString(r.start) || !isValidPartialDateString(r.end)) err(`${where}: relationship[${i}] invalid dates`);
  }
  for (const [i, m] of (ex.media ?? []).entries()) {
    if (!m.headline.trim() || !m.summary.trim()) err(`${where}: media[${i}] needs headline and summary`);
    if (m.published_date !== "@run-date" && !isValidPartialDateString(m.published_date)) err(`${where}: media[${i}] invalid published_date`);
    if (!isValidPartialDateString(m.event_date)) err(`${where}: media[${i}] invalid event_date`);
    if (m.summary.length > 600) err(`${where}: media[${i}] summary too long (keep summaries short and original)`);
  }
}

function factDisplayText(f: NonNullable<FixtureDocExtraction["facts"]>[number]): string {
  return [
    f.title,
    f.organisation,
    f.institution,
    f.qualification,
    f.field,
    f.place,
    f.statement,
    f.award_name,
    f.publication_title,
    f.english_rendering,
  ]
    .filter(Boolean)
    .join(" ");
}

function checkSynthesis(bundle: FixturePersonBundle, docs: Map<string, FixtureDocument>) {
  for (const version of [1, 2] as const) {
    const synthesis = bundle.synthesis[version];
    if (!synthesis) continue;
    const available = new Set(fixtureDocumentsForVersion(version).map((d) => d.key));
    const entries = Object.entries(bundle.extraction).filter(([k]) => available.has(k));
    const facts = entries.flatMap(([, ex]) => ex.facts ?? []);
    const media = entries.flatMap(([, ex]) => ex.media ?? []);
    const where = `${bundle.person.key} synthesis v${version}`;
    const claimSelectors = [
      ...synthesis.summary.flatMap((s) => s.claims),
      ...synthesis.keyDevelopments.flatMap((s) => s.claims),
      ...synthesis.questions.flatMap((q) => q.claims),
    ];
    for (const sel of claimSelectors) {
      const hit = facts.some(
        (f) => f.category === sel.category && normaliseForMatch(factDisplayText(f)).includes(normaliseForMatch(sel.contains)),
      );
      if (!hit) err(`${where}: claim selector ${sel.category}~"${sel.contains}" matches no fact`);
    }
    const mediaSelectors = [
      ...synthesis.summary.flatMap((s) => s.media),
      ...synthesis.keyDevelopments.flatMap((s) => s.media),
      ...synthesis.questions.flatMap((q) => q.media),
    ];
    for (const sel of mediaSelectors) {
      if (!media.some((m) => normaliseForMatch(m.headline).includes(normaliseForMatch(sel.headlineContains)))) {
        err(`${where}: media selector "${sel.headlineContains}" matches no media item`);
      }
    }
    for (const s of synthesis.summary) {
      if (s.kind === "sourced" && s.claims.length === 0 && s.media.length === 0) err(`${where}: sourced sentence without selectors: "${s.text.slice(0, 60)}"`);
    }
    for (const q of synthesis.questions) {
      if (q.claims.length === 0 && q.media.length === 0) err(`${where}: question not grounded in claims/media`);
    }
  }
  void docs;
}

function main() {
  const all = allFixtureDocuments();
  const byKey = new Map<string, FixtureDocument>();
  for (const doc of all) {
    if (byKey.has(doc.key)) err(`duplicate document key ${doc.key}`);
    byKey.set(doc.key, doc);
    checkDocument(doc);
  }
  for (const version of [1, 2]) {
    const urls = new Set<string>();
    for (const doc of fixtureDocumentsForVersion(version)) {
      if (urls.has(doc.url)) err(`version ${version}: duplicate url ${doc.url}`);
      urls.add(doc.url);
    }
  }
  const personKeys = new Set<string>();
  for (const bundle of FIXTURE_BUNDLES) {
    const p = bundle.person;
    if (personKeys.has(p.key)) err(`duplicate person key ${p.key}`);
    personKeys.add(p.key);
    if (!byKey.has(p.anchorDocKey)) err(`${p.key}: anchorDocKey ${p.anchorDocKey} not found`);
    if (!bundle.extraction[p.anchorDocKey]) err(`${p.key}: anchor document has no extraction entry`);
    for (const [docKey, ex] of Object.entries(bundle.extraction)) checkExtraction(bundle, docKey, ex, byKey);
    checkSynthesis(bundle, byKey);
    if (!bundle.synthesis[1]) err(`${p.key}: missing version-1 synthesis`);
    const discoverable = all.filter(
      (d) => d.categories.includes("discovery") && d.nameForms.some((f) => p.nameVariants.some((v) => queryMentionsName(v, f))),
    );
    if (discoverable.length === 0) err(`${p.key}: no discovery document matches the person's name variants`);
  }
  for (const example of FIXTURE_EXAMPLES) {
    const matched = all.some((d) => d.categories.includes("discovery") && d.nameForms.some((f) => queryMentionsName(example.fullName, f)));
    if (!matched) err(`example "${example.label}" (${example.fullName}) finds no discovery document`);
  }
  if (FIXTURE_BUNDLES.length === 0) warnings.push("no fixture bundles registered yet");

  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length > 0) {
    console.error(`\n${errors.length} fixture error(s):`);
    for (const e of errors) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`fixtures ok: ${FIXTURE_BUNDLES.length} people, ${all.length} documents, ${FIXTURE_EXAMPLES.length} examples`);
}

main();
