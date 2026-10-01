import type { IdentityResolutionMethod, MatchReason, MatchStrength } from "@/lib/domain/types";
import { organisationKey } from "@/lib/evidence";
import { compareNames, type NameMatchLevel } from "@/lib/names";
import type { DiscoveryCandidate } from "@/lib/research/schemas";
import { normaliseForMatch } from "@/lib/research/text";
import { canonicaliseUrl, registrableDomain } from "@/lib/urls/canonical";

/**
 * Identity resolution. Match reasons are computed deterministically from the
 * query and the candidate's own sources; the model only proposes groupings.
 *
 * DOCUMENTED AUTO-SELECTION RULE (anything else asks the owner):
 *  1. The owner supplied a profile URL and exactly one candidate's sources
 *     include that exact page (canonical URL match); or
 *  2. The owner supplied a company, exactly one candidate's documented
 *     organisation matches it, that candidate's name matches exactly or as a
 *     transliteration, and it is supported by at least two independent
 *     websites.
 * A name alone never selects a person, even when only one candidate exists.
 */

export type CandidateDocument = { key: string; url: string; canonicalUrl: string; title: string | null; snippet: string | null };

export type EvaluatedCandidate = {
  rank: number;
  displayName: string;
  nativeName: string | null;
  organisation: string | null;
  role: string | null;
  location: string | null;
  summary: string;
  distinguishingFacts: string[];
  sourceKeys: string[];
  anchorSourceKey: string | null;
  matchStrength: MatchStrength;
  matchReasons: MatchReason[];
  nameMatch: NameMatchLevel;
  companyMatch: boolean;
  profileUrlMatch: boolean;
  independentDomains: number;
  anchorKey: string;
  anchorUrls: string[];
  nameVariants: string[];
  fixturePersonKey: string | null;
};

export type IdentityQuery = { fullName: string; company: string | null; country: string | null; profileUrl: string | null };

function companyMatches(company: string, organisation: string | null, texts: string[]): boolean {
  const target = organisationKey(company);
  if (!target) return false;
  const org = organisationKey(organisation);
  if (org && (org.includes(target) || target.includes(org))) return true;
  // The company is named next to the person in the candidate's own sources.
  const needle = normaliseForMatch(company);
  return needle.length >= 4 && texts.some((t) => normaliseForMatch(t).includes(needle));
}

export function evaluateCandidates(
  candidates: DiscoveryCandidate[],
  documents: CandidateDocument[],
  query: IdentityQuery,
  queryVariants: string[],
): EvaluatedCandidate[] {
  const docs = new Map(documents.map((d) => [d.key, d]));
  const profileCanonical = query.profileUrl ? canonicaliseUrl(query.profileUrl) : null;

  // A source may support only one candidate; ambiguous assignments are dropped from both.
  const owners = new Map<string, number>();
  candidates.forEach((c) => c.source_ids.forEach((id) => owners.set(id, (owners.get(id) ?? 0) + 1)));

  const evaluated = candidates
    .map((c) => {
      const sourceKeys = [...new Set(c.source_ids)].filter((id) => docs.has(id) && owners.get(id) === 1);
      return { c, sourceKeys };
    })
    .filter(({ sourceKeys }) => sourceKeys.length > 0)
    .map(({ c, sourceKeys }) => {
      const sourceDocs = sourceKeys.map((k) => docs.get(k)!);
      const texts = sourceDocs.map((d) => `${d.title ?? ""} ${d.snippet ?? ""}`);
      const domains = new Set(sourceDocs.map((d) => registrableDomain(d.url) ?? d.url));
      const nameLevels = [c.display_name, c.native_name]
        .filter((n): n is string => Boolean(n))
        .map((n) => compareNames(query.fullName, n, queryVariants));
      const order: NameMatchLevel[] = ["exact", "variant", "phonetic", "none"];
      const nameMatch = nameLevels.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? "none";
      const companyMatch = query.company ? companyMatches(query.company, c.organisation, texts) : false;
      const profileUrlMatch = Boolean(profileCanonical && sourceDocs.some((d) => d.canonicalUrl === profileCanonical));
      const countryMatch = Boolean(
        query.country && [c.location ?? "", ...texts].some((t) => normaliseForMatch(t).includes(normaliseForMatch(query.country!))),
      );
      const anchorKeyDoc = c.anchor_source_id && sourceKeys.includes(c.anchor_source_id) ? docs.get(c.anchor_source_id)! : null;

      const reasons: MatchReason[] = [];
      if (profileUrlMatch) reasons.push({ code: "profile_url_match", text: "Sources include the profile page you supplied.", sourceKeys: sourceDocs.filter((d) => d.canonicalUrl === profileCanonical).map((d) => d.key) });
      if (nameMatch === "exact") reasons.push({ code: "name_exact", text: "Name matches exactly.", sourceKeys });
      else if (nameMatch === "variant") reasons.push({ code: "name_variant", text: `Name matches as a spelling or script variant (${[c.display_name, c.native_name].filter(Boolean).join(" / ")}).`, sourceKeys });
      else if (nameMatch === "phonetic") reasons.push({ code: "name_variant", text: `Similar spelling only (${c.display_name}); treat with care.`, sourceKeys });
      if (query.company) {
        if (companyMatch) reasons.push({ code: "company_match", text: `Linked to ${c.organisation ?? query.company}, matching the company you entered.`, sourceKeys });
        else if (c.organisation) reasons.push({ code: "company_mismatch", text: `Documented organisation (${c.organisation}) differs from the company you entered.`, sourceKeys });
      }
      if (query.country) {
        if (countryMatch) reasons.push({ code: "country_match", text: `Location context matches ${query.country}.`, sourceKeys });
        else if (c.location) reasons.push({ code: "country_mismatch", text: `Published location (${c.location}) does not mention ${query.country}.`, sourceKeys });
      }
      if (c.role || c.organisation) {
        reasons.push({ code: "role_context", text: [c.role, c.organisation].filter(Boolean).join(" at ") + (c.location ? `, ${c.location}` : ""), sourceKeys });
      }
      reasons.push(
        domains.size >= 2
          ? { code: "multiple_sources", text: `Described consistently by ${domains.size} independent websites.`, sourceKeys }
          : { code: "single_source", text: "Found on a single website only.", sourceKeys },
      );

      const nameOk = nameMatch === "exact" || nameMatch === "variant";
      const strength: MatchStrength =
        profileUrlMatch || (nameOk && companyMatch && domains.size >= 2)
          ? "strong"
          : nameOk && (companyMatch || countryMatch || domains.size >= 2)
            ? "moderate"
            : "weak";

      const fixturePersonKey = c.candidate_ref.startsWith("fixture:") ? c.candidate_ref.slice(8).split("#")[0] : null;
      const anchorUrls = anchorKeyDoc ? [anchorKeyDoc.url] : sourceDocs.slice(0, 2).map((d) => d.url);
      const anchorKey = fixturePersonKey
        ? `fixture:${fixturePersonKey}`
        : anchorKeyDoc
          ? `url:${anchorKeyDoc.canonicalUrl}`
          : `name:${normaliseForMatch(c.display_name)}|org:${organisationKey(c.organisation) || "unknown"}|src:${[...domains].sort().join(",")}`;

      return {
        rank: 0,
        displayName: c.display_name.trim(),
        nativeName: c.native_name?.trim() || null,
        organisation: c.organisation,
        role: c.role,
        location: c.location,
        summary: c.summary,
        distinguishingFacts: c.distinguishing_facts.slice(0, 3),
        sourceKeys,
        anchorSourceKey: anchorKeyDoc?.key ?? null,
        matchStrength: strength,
        matchReasons: reasons,
        nameMatch,
        companyMatch,
        profileUrlMatch,
        independentDomains: domains.size,
        anchorKey,
        anchorUrls,
        nameVariants: [...new Set([c.display_name, c.native_name, ...queryVariants].filter((v): v is string => Boolean(v)))],
        fixturePersonKey,
      };
    });

  const strengthOrder: Record<MatchStrength, number> = { strong: 0, moderate: 1, weak: 2 };
  return evaluated
    .sort((a, b) => strengthOrder[a.matchStrength] - strengthOrder[b.matchStrength] || b.sourceKeys.length - a.sourceKeys.length)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

export type AutoSelection =
  | { decision: "auto"; rank: number; method: IdentityResolutionMethod; reason: string; params?: { company?: string; domains?: number } }
  | { decision: "ask"; reason: string }
  | { decision: "none"; reason: string };

export function decideIdentity(candidates: EvaluatedCandidate[], query: IdentityQuery, allowAuto = true): AutoSelection {
  if (candidates.length === 0) return { decision: "none", reason: "No sources describing a person with this name were found." };
  if (!allowAuto) return { decision: "ask", reason: "Automatic selection was turned off for this search." };
  if (query.profileUrl) {
    const byUrl = candidates.filter((c) => c.profileUrlMatch);
    if (byUrl.length === 1) {
      return { decision: "auto", rank: byUrl[0].rank, method: "auto_profile_url", reason: "Selected automatically: it is the only candidate whose sources include the profile URL you supplied." };
    }
  }
  if (query.company) {
    const byCompany = candidates.filter((c) => c.companyMatch);
    const only = byCompany.length === 1 ? byCompany[0] : null;
    if (only && (only.nameMatch === "exact" || only.nameMatch === "variant") && only.independentDomains >= 2) {
      return {
        decision: "auto",
        rank: only.rank,
        method: "auto_unique_company_match",
        reason: `Selected automatically: it is the only candidate linked to "${query.company}", the name matches, and ${only.independentDomains} independent websites describe them.`,
        params: { company: query.company, domains: only.independentDomains },
      };
    }
  }
  return {
    decision: "ask",
    reason:
      candidates.length === 1
        ? "One possible match was found, but a name alone is not enough to confirm identity."
        : `${candidates.length} different people match this name.`,
  };
}
