import type { FixtureDocExtraction, FixtureDocument, FixturePersonBundle } from "@/fixtures/types";
import { fact, lines, media, relationship, source } from "@/fixtures/world/helpers";

/** Tural Mammadov (2 of 3 with this name) — software architect in Berlin (fictional). */

const speakerPage: FixtureDocument = {
  key: "spree-systems-2026-mammadov",
  url: "https://spreesystemsconf.example/2026/speakers/tural-mammadov",
  title: "Tural Mammadov — Speaker | Spree Systems Conference 2026",
  publisher: "Spree Systems Conference",
  language: "en",
  sourceType: "conference",
  publishedDate: "2026-06-15",
  access: "read",
  snippet:
    "Tural Mammadov is Principal Software Architect at Northwind Ledger GmbH in Berlin, where he leads the design of the company's event-sourced payments ledger.",
  body: lines(
    "Spree Systems Conference 2026",
    "Berlin, 10–11 September 2026",
    "",
    "Tural Mammadov",
    "Principal Software Architect, Northwind Ledger GmbH",
    "",
    "Talk: Replaying a ledger: deterministic event sourcing in production",
    "Track: Architecture. Day 2, Room Oberbaum, 10:15–11:00",
    "",
    "Tural Mammadov is Principal Software Architect at Northwind Ledger GmbH in Berlin, where he has led the design of the company's event-sourced payments ledger since joining in 2020. Before that he spent five years as a backend engineer at Spreeline Payments. He grew up in Baku, studied computer science at the Western Caspian Institute of Technology, and has lived in Berlin since 2014.",
    "",
    "In this talk he will explain how his team made ledger replays deterministic, what it cost them in storage and complexity, and which shortcuts they regret.",
    "",
    "Contact for talk-related questions: tural.mammadov@northwindledger.example",
  ),
  categories: ["discovery", "career", "contacts"],
  nameForms: ["Tural Mammadov"],
};

const personalSite: FixtureDocument = {
  key: "tmammadov-personal-site",
  url: "https://tmammadov.example/about",
  title: "About — Tural Mammadov",
  publisher: "Tural Mammadov (personal website)",
  language: "en",
  sourceType: "personal_site",
  publishedDate: null,
  access: "read",
  snippet:
    "I'm Tural Mammadov, a software architect living in Berlin. I work on ledgers, event sourcing and the unglamorous parts of payment systems that simply have to be correct.",
  body: lines(
    "About",
    "",
    "I'm Tural Mammadov, a software architect living in Berlin. I work on ledgers, event sourcing and the unglamorous parts of payment systems that simply have to be correct.",
    "",
    "Work",
    "2020–present: Principal Software Architect, Northwind Ledger GmbH, Berlin",
    "2015–2020: Backend Engineer, Spreeline Payments, Berlin",
    "",
    "Writing and talks",
    "I write here occasionally about consistency, replay and testing financial systems. Recent posts: “Idempotency keys are a contract, not a feature” and “What we learned from replaying three years of ledger events”.",
    "",
    "With Dr. Katrin Vossberg I co-authored the paper “Deterministic Replay for Event-Sourced Ledgers” (2024), presented at the Workshop on Open Financial Infrastructure.",
    "",
    "Code",
    "Most of my open-source work is at github.example/tmammadov, including the replay harness described in the paper.",
    "",
    "I don't take recruiter calls. For anything else, the contact form on this site reaches me.",
  ),
  categories: ["discovery", "career"],
  nameForms: ["Tural Mammadov"],
};

const techArticle: FixtureDocument = {
  key: "ledger-and-stack-northwind-event-sourcing",
  url: "https://ledgerandstack.example/2025/02/northwind-ledger-event-sourcing",
  title: "How Northwind Ledger rebuilt its payments ledger around event sourcing",
  publisher: "Ledger & Stack",
  language: "en",
  sourceType: "news",
  publishedDate: "2025-02-18",
  access: "read",
  snippet:
    "Berlin company Northwind Ledger spent two years moving its payments ledger to an event-sourced design. Principal architect Tural Mammadov explains the trade-offs.",
  body: lines(
    "Northwind Ledger GmbH, a Berlin company that runs ledger infrastructure for payment providers, has completed a two-year migration of its core ledger to an event-sourced architecture.",
    "",
    "Instead of updating account balances in place, the new system records every change as an immutable event and derives balances from the event history. The approach makes audits simpler, but it brings its own costs.",
    "",
    "“The hard part was not storing events, it was guaranteeing that a replay produces exactly the same balances every time,” said Tural Mammadov, principal software architect at Northwind Ledger, who led the migration. “We had to remove every hidden source of non-determinism, from clock reads to floating-point rounding.”",
    "",
    "According to Mammadov, the team now replays the full ledger history nightly in a separate environment and compares the results with production. Discrepancies, which were frequent in the first months, are now rare.",
    "",
    "Northwind Ledger has released its replay test harness as open-source software.",
  ),
  categories: ["news"],
  nameForms: ["Tural Mammadov"],
};

const paperPage: FixtureDocument = {
  key: "ofi-2024-deterministic-replay",
  url: "https://ofi-workshop.example/2024/papers/deterministic-replay-event-sourced-ledgers",
  title: "Deterministic Replay for Event-Sourced Ledgers | Workshop on Open Financial Infrastructure 2024",
  publisher: "Workshop on Open Financial Infrastructure",
  language: "en",
  sourceType: "academic",
  publishedDate: "2024-11",
  access: "read",
  snippet:
    "Tural Mammadov (Northwind Ledger GmbH) and Dr. Katrin Vossberg (Technical University of Elbmark) describe an open-source harness for checking that ledger replays are deterministic.",
  body: lines(
    "Deterministic Replay for Event-Sourced Ledgers",
    "",
    "Tural Mammadov (Northwind Ledger GmbH, Berlin) and Dr. Katrin Vossberg (Technical University of Elbmark)",
    "",
    "Proceedings of the Workshop on Open Financial Infrastructure (OFI 2024), pages 41–52.",
    "",
    "Abstract",
    "Event-sourced ledgers promise complete audit trails, but only if replaying the event history always yields the same state. We catalogue the sources of non-determinism we encountered in a production payments ledger — wall-clock reads, unordered collections, floating-point arithmetic and schema migrations — and present replay-harness, an open-source tool that replays event streams in isolation and reports divergent balances. In a case study covering three years of production events, the harness found 23 classes of divergence, all of which were fixed before the system went live. We release the harness and an anonymised benchmark dataset.",
    "",
    "Code and data: github.example/tmammadov/replay-harness",
    "",
    "Licence: CC BY 4.0",
  ),
  categories: ["connections"],
  nameForms: ["Tural Mammadov"],
};

const extraction: Record<string, FixtureDocExtraction> = {
  [speakerPage.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Conference speaker biography naming Tural Mammadov of Northwind Ledger GmbH, Berlin.",
      source_type: "conference",
      page_language: "en",
      published_date: "2026-06-15",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Northwind Ledger GmbH",
        title: "Principal Software Architect",
        start: "2020",
        currency: "stated_current",
        supporting_excerpt:
          "Tural Mammadov is Principal Software Architect at Northwind Ledger GmbH in Berlin, where he has led the design of the company's event-sourced payments ledger since joining in 2020.",
      }),
      fact({
        category: "education",
        institution: "Western Caspian Institute of Technology",
        field: "Computer Science",
        supporting_excerpt: "studied computer science at the Western Caspian Institute of Technology",
      }),
      fact({
        category: "location",
        place: "Berlin",
        place_scope: "based",
        start: "2014",
        currency: "stated_current",
        supporting_excerpt: "has lived in Berlin since 2014",
      }),
    ],
    contacts: [
      {
        contact_type: "work_email",
        value: "tural.mammadov@northwindledger.example",
        belongs_to: "person",
        owner_label: "Tural Mammadov",
        purpose: "Talk-related questions",
        publication_context: "Published by the Spree Systems Conference on his speaker page",
        supporting_excerpt: "Contact for talk-related questions: tural.mammadov@northwindledger.example",
      },
    ],
  },
  [personalSite.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "First-person personal website listing his roles at Northwind Ledger GmbH and Spreeline Payments.",
      source_type: "personal_site",
      page_language: "en",
      self_published: true,
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Northwind Ledger GmbH",
        title: "Principal Software Architect",
        start: "2020",
        currency: "stated_current",
        supporting_excerpt: "2020–present: Principal Software Architect, Northwind Ledger GmbH, Berlin",
      }),
      fact({
        category: "employment",
        organisation: "Spreeline Payments",
        title: "Backend Engineer",
        start: "2015",
        end: "2020",
        currency: "ended",
        supporting_excerpt: "2015–2020: Backend Engineer, Spreeline Payments, Berlin",
      }),
      fact({
        category: "location",
        place: "Berlin",
        place_scope: "based",
        currency: "stated_current",
        supporting_excerpt: "a software architect living in Berlin",
      }),
      fact({
        category: "publication",
        publication_title: "Deterministic Replay for Event-Sourced Ledgers",
        venue: "Workshop on Open Financial Infrastructure",
        start: "2024",
        supporting_excerpt:
          "I co-authored the paper “Deterministic Replay for Event-Sourced Ledgers” (2024), presented at the Workshop on Open Financial Infrastructure.",
      }),
    ],
    accounts: [
      {
        platform: "github",
        url: "https://github.example/tmammadov",
        handle: "tmammadov",
        description: "Open-source code",
        discovery: "linked_from_personal_site",
        supporting_excerpt: "Most of my open-source work is at github.example/tmammadov",
        identity_evidence: "Linked from his personal website.",
      },
      {
        platform: "website",
        url: "https://tmammadov.example",
        handle: null,
        description: "Personal website",
        discovery: "accessible_page",
        supporting_excerpt: "I'm Tural Mammadov, a software architect living in Berlin.",
        identity_evidence: "First-person site whose career details match his conference biography.",
      },
    ],
    relationships: [
      relationship({
        relation_type: "co_author",
        counterpart_name: "Katrin Vossberg",
        counterpart_role: "Co-author",
        project: "Deterministic Replay for Event-Sourced Ledgers",
        start: "2024",
        supporting_excerpt:
          "With Dr. Katrin Vossberg I co-authored the paper “Deterministic Replay for Event-Sourced Ledgers” (2024)",
      }),
    ],
  },
  [techArticle.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Quotes Tural Mammadov as principal software architect at Northwind Ledger.",
      source_type: "news",
      page_language: "en",
      published_date: "2025-02-18",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Northwind Ledger GmbH",
        title: "Principal Software Architect",
        supporting_excerpt: "said Tural Mammadov, principal software architect at Northwind Ledger, who led the migration",
      }),
    ],
    media: [
      media({
        headline: techArticle.title,
        outlet: "Ledger & Stack",
        kind: "article",
        published_date: "2025-02-18",
        language: "en",
        summary:
          "Technical feature on Northwind Ledger's two-year move to an event-sourced ledger. Mammadov, who led the migration, explains that the hardest part was making replays produce identical balances, which the team now checks nightly.",
        involvement: "Led the migration; main interviewee",
        coverage_type: "direct",
        topic: "business",
        identity_evidence: "Names him as principal software architect at Northwind Ledger.",
      }),
    ],
  },
  [paperPage.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Paper authorship lists Tural Mammadov of Northwind Ledger GmbH, Berlin.",
      source_type: "academic",
      page_language: "en",
      published_date: "2024-11",
    }),
    facts: [
      fact({
        category: "publication",
        publication_title: "Deterministic Replay for Event-Sourced Ledgers",
        venue: "Workshop on Open Financial Infrastructure (OFI 2024)",
        start: "2024-11",
        supporting_excerpt:
          "Tural Mammadov (Northwind Ledger GmbH, Berlin) and Dr. Katrin Vossberg (Technical University of Elbmark)",
      }),
    ],
    relationships: [
      relationship({
        relation_type: "co_author",
        counterpart_name: "Katrin Vossberg",
        counterpart_role: "Technical University of Elbmark",
        project: "Deterministic Replay for Event-Sourced Ledgers",
        start: "2024",
        supporting_excerpt:
          "Tural Mammadov (Northwind Ledger GmbH, Berlin) and Dr. Katrin Vossberg (Technical University of Elbmark)",
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

const ARCHITECT = { category: "employment", contains: "Principal Software Architect" } as const;
const PAPER = { category: "publication", contains: "Deterministic Replay" } as const;
const MIGRATION = { headlineContains: "rebuilt its payments ledger" } as const;

export const turalMammadovArchitect: FixturePersonBundle = {
  person: {
    key: "tural-mammadov-architect",
    displayName: "Tural Mammadov",
    nativeName: null,
    nameVariants: ["Tural Mammadov"],
    organisation: "Northwind Ledger GmbH",
    role: "Principal Software Architect",
    location: "Berlin, Germany",
    summary: "Principal software architect at Northwind Ledger GmbH in Berlin, working on event-sourced payment ledgers.",
    distinguishingFacts: [
      "Principal Software Architect at Northwind Ledger GmbH, Berlin, since 2020",
      "Co-author of a 2024 paper on deterministic replay for event-sourced ledgers",
      "Previously a backend engineer at Spreeline Payments",
    ],
    anchorDocKey: speakerPage.key,
    scenarios: ["ambiguous"],
  },
  documents: [speakerPage, personalSite, techArticle, paperPage],
  extraction,
  synthesis: {
    1: {
      summary: [
        {
          text: "Tural Mammadov is Principal Software Architect at Northwind Ledger GmbH in Berlin, where he has led the design of the company's event-sourced payments ledger since 2020.",
          claims: [ARCHITECT, { category: "location", contains: "Berlin" }],
          media: [],
          kind: "sourced",
        },
        {
          text: "He previously worked as a backend engineer at Spreeline Payments from 2015 to 2020 and studied computer science at the Western Caspian Institute of Technology.",
          claims: [
            { category: "employment", contains: "Backend Engineer" },
            { category: "education", contains: "Western Caspian Institute of Technology" },
          ],
          media: [],
          kind: "sourced",
        },
        {
          text: "With Dr. Katrin Vossberg he co-authored “Deterministic Replay for Event-Sourced Ledgers” (2024), which presents an open-source tool for detecting divergent ledger replays.",
          claims: [PAPER],
          media: [],
          kind: "sourced",
        },
        {
          text: "A 2025 trade feature describes him leading Northwind Ledger's two-year migration to an event-sourced ledger.",
          claims: [],
          media: [MIGRATION],
          kind: "sourced",
        },
        {
          text: "His published work and talks consistently centre on correctness and auditability in financial systems.",
          claims: [PAPER],
          media: [MIGRATION],
          kind: "inferred",
        },
      ],
      keyDevelopments: [
        {
          text: "Northwind Ledger completed a two-year migration of its core ledger to an event-sourced architecture, led by Mammadov.",
          claims: [],
          media: [MIGRATION],
          date: "2025-02-18",
        },
        {
          text: "Published “Deterministic Replay for Event-Sourced Ledgers” with Dr. Katrin Vossberg at the Workshop on Open Financial Infrastructure.",
          claims: [PAPER],
          media: [],
          date: "2024-11",
        },
      ],
      gaps: [
        "No graduation year or degree level was found for his computer science studies.",
        "No direct telephone contact was found; the only published work contact is an email for talk-related questions.",
        "Two other people named Tural Mammadov appear in search results; only sources naming Northwind Ledger or his own site were used.",
      ],
      questions: [
        {
          question: "Which sources of non-determinism were hardest to remove during the ledger migration, and how are they monitored now?",
          claims: [ARCHITECT],
          media: [MIGRATION],
        },
        {
          question: "How widely has the open-source replay harness been adopted outside Northwind Ledger?",
          claims: [PAPER],
          media: [],
        },
      ],
    },
  },
};
