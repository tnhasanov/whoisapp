import type { FixtureDocument, FixturePersonBundle } from "@/fixtures/types";
import { fact, lines, source } from "@/fixtures/world/helpers";

/** Sevinj Abbasli — sparse record: a single conference speaker page (fictional). */

const speakerPage: FixtureDocument = {
  key: "caspian-logistics-forum-2025-abbasli",
  url: "https://caspianlogisticsforum.example/2025/speakers/sevinj-abbasli",
  title: "Sevinj Abbasli — Speaker | Caspian Logistics Forum 2025",
  publisher: "Caspian Logistics Forum",
  language: "en",
  sourceType: "conference",
  publishedDate: "2025-10-14",
  access: "read",
  snippet:
    "Sevinj Abbasli (Sevinc Abbaslı), Procurement Lead at Absheron Tidewater Logistics, joins the panel “Resilient sourcing for Caspian ports” at the Caspian Logistics Forum 2025 in Baku.",
  body: lines(
    "Caspian Logistics Forum 2025",
    "Baku, 19–20 November 2025",
    "",
    "Speaker",
    "Sevinj Abbasli (Sevinc Abbaslı)",
    "Procurement Lead, Absheron Tidewater Logistics",
    "",
    "Panel: Resilient sourcing for Caspian ports",
    "Day 1, Conference Hall A, 15:30–16:30",
    "",
    "Sevinj Abbasli is Procurement Lead at Absheron Tidewater Logistics, where she is responsible for sourcing port equipment and maintenance services. On this panel she will discuss how port operators can reduce their dependence on single suppliers for critical spare parts, and what that means for contracts and inventories.",
    "",
    "The panel is moderated by the forum's programme committee. Other panelists will be announced in November.",
  ),
  categories: ["discovery", "career"],
  nameForms: ["Sevinj Abbasli", "Sevinc Abbaslı"],
};

const PROCUREMENT = { category: "employment", contains: "Procurement Lead" } as const;

export const sevinjAbbasli: FixturePersonBundle = {
  person: {
    key: "sevinj-abbasli",
    displayName: "Sevinj Abbasli",
    nativeName: "Sevinc Abbaslı",
    nameVariants: ["Sevinj Abbasli", "Sevinc Abbaslı"],
    organisation: "Absheron Tidewater Logistics",
    role: "Procurement Lead",
    location: null,
    summary: "Procurement lead at Absheron Tidewater Logistics, listed as a speaker at the Caspian Logistics Forum 2025.",
    distinguishingFacts: [
      "Procurement Lead at Absheron Tidewater Logistics",
      "Panelist at the Caspian Logistics Forum 2025 in Baku",
    ],
    anchorDocKey: speakerPage.key,
    scenarios: ["sparse"],
  },
  documents: [speakerPage],
  extraction: {
    [speakerPage.key]: {
      source: source({
        about_subject: "yes",
        identity_evidence: "Conference speaker page naming Sevinj Abbasli of Absheron Tidewater Logistics.",
        source_type: "conference",
        page_language: "en",
        published_date: "2025-10-14",
      }),
      facts: [
        fact({
          category: "employment",
          organisation: "Absheron Tidewater Logistics",
          title: "Procurement Lead",
          currency: "stated_current",
          supporting_excerpt:
            "Sevinj Abbasli is Procurement Lead at Absheron Tidewater Logistics, where she is responsible for sourcing port equipment and maintenance services.",
        }),
      ],
    },
  },
  synthesis: {
    1: {
      summary: [
        {
          text: "Sevinj Abbasli (Sevinc Abbaslı) is Procurement Lead at Absheron Tidewater Logistics, responsible for sourcing port equipment and maintenance services, according to her speaker profile for the Caspian Logistics Forum 2025.",
          claims: [PROCUREMENT],
          media: [],
          kind: "sourced",
        },
      ],
      keyDevelopments: [],
      // Wording that matches the pipeline's own gap texts is de-duplicated at run time.
      gaps: [
        "No published education history was found.",
        "No career history before her current role was found.",
        "No public business contact found.",
        "No news coverage directly about this person was found.",
        "Only one source was found: a conference speaker page.",
      ],
      questions: [
        {
          question: "How is Absheron Tidewater Logistics reducing its dependence on single suppliers for critical port spare parts?",
          claims: [PROCUREMENT],
          media: [],
        },
      ],
    },
  },
};
