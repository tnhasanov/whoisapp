import type { FixtureDocument, FixtureExample, FixturePersonBundle } from "@/fixtures/types";
import { FIXTURE_EXAMPLES as EXAMPLES } from "@/fixtures/world/examples";
import { elnaraGasimova } from "@/fixtures/world/people/elnara-gasimova";
import { elnaraGasimovaKazan } from "@/fixtures/world/people/elnara-gasimova-kazan";
import { javidNuriyev } from "@/fixtures/world/people/javid-nuriyev";
import { sevinjAbbasli } from "@/fixtures/world/people/sevinj-abbasli";
import { turalMammadovArchitect } from "@/fixtures/world/people/tural-mammadov-architect";
import { turalMammadovEngineer } from "@/fixtures/world/people/tural-mammadov-engineer";
import { turalMammadovLecturer } from "@/fixtures/world/people/tural-mammadov-lecturer";
import { SHARED_DOCUMENTS as SHARED } from "@/fixtures/world/shared";

/**
 * Registry of the fictional demo world. Person bundles are added in
 * ./people/*.ts and registered here. Documents may be shared between bundles
 * (e.g. same-name search results); each document is defined exactly once.
 *
 * Order matters: the fixture search returns matching documents in this order
 * (bundles first, then shared documents) and stops at the request's
 * maxResults, so the per-category document counts in each bundle are kept
 * within the default limits.
 */
export const FIXTURE_BUNDLES: FixturePersonBundle[] = [
  elnaraGasimova,
  elnaraGasimovaKazan,
  turalMammadovEngineer,
  turalMammadovArchitect,
  turalMammadovLecturer,
  sevinjAbbasli,
  javidNuriyev,
];

/** Documents that belong to no particular bundle (namesakes, unrelated results). */
export const SHARED_DOCUMENTS: FixtureDocument[] = SHARED;

export const FIXTURE_EXAMPLES: FixtureExample[] = EXAMPLES;

export const FIXTURE_WORLD_MAX_VERSION = 2;

export function allFixtureDocuments(): FixtureDocument[] {
  return [...FIXTURE_BUNDLES.flatMap((b) => b.documents), ...SHARED_DOCUMENTS];
}

export function fixtureDocumentsForVersion(version: number): FixtureDocument[] {
  return allFixtureDocuments().filter((d) => (d.versions ?? [1, 2]).includes(version));
}

export function findFixtureDocument(key: string): FixtureDocument | undefined {
  return allFixtureDocuments().find((d) => d.key === key);
}

export function findFixtureBundle(personKey: string): FixturePersonBundle | undefined {
  return FIXTURE_BUNDLES.find((b) => b.person.key === personKey);
}
