import type { FixtureDocExtraction, FixtureDocument, FixturePersonBundle } from "@/fixtures/types";
import { fact, lines, media, source } from "@/fixtures/world/helpers";

/** Tural Mammadov (1 of 3 with this name) — drilling engineer in Baku (fictional). */

const teamPage: FixtureDocument = {
  key: "kura-basin-team-mammadov",
  url: "https://kurabasindrilling.example/about/team/tural-mammadov",
  title: "Tural Mammadov — Senior Drilling Engineer | Kura Basin Drilling Services",
  publisher: "Kura Basin Drilling Services",
  language: "en",
  sourceType: "company_site",
  publishedDate: null,
  access: "read",
  snippet:
    "Tural Mammadov is a Senior Drilling Engineer at Kura Basin Drilling Services in Baku, responsible for well planning on onshore and shallow-water projects.",
  body: lines(
    "Tural Mammadov",
    "Senior Drilling Engineer, Baku",
    "",
    "Tural Mammadov joined Kura Basin Drilling Services in 2015 as a field engineer and has been a Senior Drilling Engineer since 2020. Based at the company's Baku operations centre, he is responsible for well planning and drilling programmes on onshore and shallow-water projects, with a focus on extended-reach and directional wells.",
    "",
    "Before joining the company he worked as a mud logger for offshore service contractors in the Caspian. He holds a degree in petroleum engineering and is a certified well-control supervisor.",
    "",
    "Tural also leads the company's internal training course on well-control procedures for newly hired engineers.",
  ),
  categories: ["discovery", "career"],
  nameForms: ["Tural Mammadov"],
};

const drillingArticle: FixtureDocument = {
  key: "caspian-drilling-review-extended-reach",
  url: "https://caspiandrillingreview.example/2024/10/08/kura-basin-extended-reach-well",
  title: "Kura Basin Drilling Services completes extended-reach well ahead of schedule",
  publisher: "Caspian Drilling Review",
  language: "en",
  sourceType: "news",
  publishedDate: "2024-10-08",
  access: "read",
  snippet:
    "Kura Basin Drilling Services has completed an extended-reach well near Baku nine days ahead of plan, according to senior drilling engineer Tural Mammadov, who led the well-planning team.",
  body: lines(
    "Kura Basin Drilling Services has completed an extended-reach well near Baku nine days ahead of schedule, the company said this week.",
    "",
    "The well reaches a measured depth of 6,200 metres, with a horizontal step-out of more than 4,000 metres from the onshore drilling site to a shallow-water target. The company said it used a revised casing design and real-time torque-and-drag monitoring to reduce non-productive time.",
    "",
    "“Most of the time we saved came from planning, not from drilling faster,” said Tural Mammadov, senior drilling engineer at Kura Basin Drilling Services, who led the well-planning team. “We modelled every section before the rig arrived and agreed the contingencies with the operator in advance.”",
    "",
    "The well is the third extended-reach well the company has drilled in the area since 2021. Kura Basin Drilling Services provides drilling engineering and well-site supervision to operators in Azerbaijan and Kazakhstan.",
  ),
  categories: ["discovery", "news"],
  nameForms: ["Tural Mammadov"],
};

const extraction: Record<string, FixtureDocExtraction> = {
  [teamPage.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Team page on the Kura Basin Drilling Services website.",
      source_type: "company_site",
      page_language: "en",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Kura Basin Drilling Services",
        title: "Senior Drilling Engineer",
        start: "2020",
        currency: "stated_current",
        supporting_excerpt: "has been a Senior Drilling Engineer since 2020",
      }),
      fact({
        category: "employment",
        organisation: "Kura Basin Drilling Services",
        title: "Field Engineer",
        start: "2015",
        end: "2020",
        currency: "ended",
        supporting_excerpt:
          "Tural Mammadov joined Kura Basin Drilling Services in 2015 as a field engineer and has been a Senior Drilling Engineer since 2020.",
      }),
      fact({
        category: "location",
        place: "Baku",
        place_scope: "work",
        currency: "stated_current",
        supporting_excerpt: "Based at the company's Baku operations centre",
      }),
    ],
  },
  [drillingArticle.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Quotes Tural Mammadov as senior drilling engineer at Kura Basin Drilling Services.",
      source_type: "news",
      page_language: "en",
      published_date: "2024-10-08",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Kura Basin Drilling Services",
        title: "Senior Drilling Engineer",
        supporting_excerpt:
          "said Tural Mammadov, senior drilling engineer at Kura Basin Drilling Services, who led the well-planning team",
      }),
    ],
    media: [
      media({
        headline: drillingArticle.title,
        outlet: "Caspian Drilling Review",
        kind: "article",
        published_date: "2024-10-08",
        language: "en",
        summary:
          "Trade report on an extended-reach well near Baku completed nine days early. Mammadov, who led the well-planning team, attributes most of the time saved to detailed planning and agreed contingencies.",
        involvement: "Led the well-planning team; quoted",
        coverage_type: "direct",
        topic: "business",
        identity_evidence: "Names him as senior drilling engineer at Kura Basin Drilling Services.",
      }),
    ],
  },
  // Same name only: the chess standings give no organisation, role or location.
  "baku-rapid-chess-open-2025": {
    source: source({
      about_subject: "unclear",
      identity_evidence: "Only the name matches; the standings give no organisation, role, age or location for the player.",
      source_type: "other",
      page_language: "en",
      published_date: "2025-03-30",
    }),
  },
};

export const turalMammadovEngineer: FixturePersonBundle = {
  person: {
    key: "tural-mammadov-engineer",
    displayName: "Tural Mammadov",
    nativeName: null,
    nameVariants: ["Tural Mammadov"],
    organisation: "Kura Basin Drilling Services",
    role: "Senior Drilling Engineer",
    location: "Baku, Azerbaijan",
    summary: "Senior drilling engineer at Kura Basin Drilling Services in Baku, working on well planning for onshore and shallow-water projects.",
    distinguishingFacts: [
      "Senior Drilling Engineer at Kura Basin Drilling Services since 2020",
      "Based at the company's Baku operations centre",
      "Works on extended-reach and directional wells",
    ],
    anchorDocKey: teamPage.key,
    scenarios: ["ambiguous"],
  },
  documents: [teamPage, drillingArticle],
  extraction,
  synthesis: {
    1: {
      summary: [
        {
          text: "Tural Mammadov is a Senior Drilling Engineer at Kura Basin Drilling Services, based at the company's Baku operations centre.",
          claims: [
            { category: "employment", contains: "Senior Drilling Engineer" },
            { category: "location", contains: "Baku" },
          ],
          media: [],
          kind: "sourced",
        },
        {
          text: "He joined the company in 2015 as a field engineer and has held the senior drilling engineer role since 2020.",
          claims: [
            { category: "employment", contains: "Field Engineer" },
            { category: "employment", contains: "Senior Drilling Engineer" },
          ],
          media: [],
          kind: "sourced",
        },
        {
          text: "In October 2024 he was quoted as leader of the well-planning team when the company completed an extended-reach well near Baku nine days ahead of schedule.",
          claims: [],
          media: [{ headlineContains: "extended-reach well" }],
          kind: "sourced",
        },
      ],
      keyDevelopments: [
        {
          text: "Kura Basin Drilling Services completed an extended-reach well near Baku nine days ahead of schedule; Mammadov led the well-planning team.",
          claims: [],
          media: [{ headlineContains: "extended-reach well" }],
          date: "2024-10-08",
        },
      ],
      gaps: [
        "His degree in petroleum engineering is mentioned without the institution or year.",
        "Two other people named Tural Mammadov appear in search results; only sources naming Kura Basin Drilling Services were used.",
      ],
      questions: [
        {
          question: "Which planning practices from the extended-reach well have since become standard on the company's projects?",
          claims: [{ category: "employment", contains: "Senior Drilling Engineer" }],
          media: [{ headlineContains: "extended-reach well" }],
        },
      ],
    },
  },
};
