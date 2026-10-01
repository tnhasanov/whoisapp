import type { FixtureDocExtraction } from "@/fixtures/types";

/**
 * Small builders for fixture extraction output. They only fill the nullable
 * fields with null so that each fixture states what the source supports and
 * nothing else; the shapes are the real extraction schemas.
 */

type Source = FixtureDocExtraction["source"];
type Fact = NonNullable<FixtureDocExtraction["facts"]>[number];
type Relationship = NonNullable<FixtureDocExtraction["relationships"]>[number];
type Media = NonNullable<FixtureDocExtraction["media"]>[number];

/** Joins lines of page text; an empty string gives a blank line between paragraphs. */
export function lines(...parts: string[]): string {
  return parts.join("\n");
}

export function source(
  input: Pick<Source, "about_subject" | "identity_evidence" | "source_type" | "page_language"> & Partial<Source>,
): Source {
  return { published_date: null, updated_date: null, self_published: false, ...input };
}

export function fact(input: Pick<Fact, "category" | "supporting_excerpt"> & Partial<Fact>): Fact {
  return {
    organisation: null,
    title: null,
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
    english_rendering: null,
    ...input,
  };
}

export function relationship(
  input: Pick<Relationship, "relation_type" | "counterpart_name" | "supporting_excerpt"> & Partial<Relationship>,
): Relationship {
  return { counterpart_role: null, organisation: null, project: null, start: null, end: null, ...input };
}

export function media(input: Omit<Media, "event_date" | "allegations"> & Partial<Pick<Media, "event_date" | "allegations">>): Media {
  return { event_date: null, allegations: null, ...input };
}
