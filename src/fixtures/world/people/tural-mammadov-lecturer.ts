import type { FixtureDocExtraction, FixtureDocument, FixturePersonBundle } from "@/fixtures/types";
import { fact, lines, media, source } from "@/fixtures/world/helpers";

/** Tural Məmmədov (3 of 3 named Tural Mammadov) — economics lecturer in Ganja (fictional). */

const staffPage: FixtureDocument = {
  key: "gdii-staff-memmedov",
  url: "https://gdii.example/kafedralar/iqtisadi-nezeriyye/tural-memmedov",
  title: "Tural Məmmədov — İqtisadi nəzəriyyə kafedrasının müəllimi | Gəncə Dövlət İqtisadiyyat İnstitutu",
  publisher: "Gəncə Dövlət İqtisadiyyat İnstitutu",
  language: "az",
  sourceType: "official_bio",
  publishedDate: null,
  access: "read",
  snippet:
    "Tural Məmmədov Gəncə Dövlət İqtisadiyyat İnstitutunun İqtisadi nəzəriyyə kafedrasında müəllim işləyir. Elmi maraq dairəsi regional iqtisadiyyat və kiçik sahibkarlıqdır.",
  body: lines(
    "Tural Məmmədov",
    "İqtisadi nəzəriyyə kafedrasının müəllimi",
    "",
    "Tural Məmmədov 2018-ci ildən Gəncə Dövlət İqtisadiyyat İnstitutunun İqtisadi nəzəriyyə kafedrasında müəllim kimi çalışır. Bakalavr tələbələrinə mikroiqtisadiyyat və regional iqtisadiyyat fənlərini tədris edir.",
    "",
    "Elmi maraq dairəsi: regional iqtisadi inkişaf, kiçik və orta sahibkarlıq, kənd təsərrüfatı məhsulları bazarları. Son illərdə Gəncə və ətraf rayonlarda kiçik müəssisələrin maliyyəyə çıxışını araşdırır.",
    "",
    "Təhsili: 2017-ci ildə həmin institutda iqtisadiyyat ixtisası üzrə magistr dərəcəsi alıb.",
    "",
    "Kafedranın tələbə elmi dərnəyinə rəhbərlik edir. 15-dən çox elmi məqalənin müəllifidir.",
    "",
    "Kafedra ilə əlaqə institutun rəsmi saytındakı əlaqə forması vasitəsilə mümkündür.",
  ),
  categories: ["discovery", "career"],
  nameForms: ["Tural Məmmədov"],
};

const seminarNews: FixtureDocument = {
  key: "gdii-news-seminar-2025",
  url: "https://gdii.example/xeberler/2025/04/regional-sahibkarliq-seminari",
  title: "İnstitutda regional sahibkarlığa həsr olunmuş seminar keçirilib",
  publisher: "Gəncə Dövlət İqtisadiyyat İnstitutu",
  language: "az",
  sourceType: "news",
  publishedDate: "2025-04-23",
  access: "read",
  snippet:
    "İqtisadi nəzəriyyə kafedrasının müəllimi Tural Məmmədov Gəncə və ətraf rayonlarda kiçik sahibkarlığın maliyyələşməsi mövzusunda apardığı sorğunun ilkin nəticələrini təqdim edib.",
  body: lines(
    "Aprelin 22-də Gəncə Dövlət İqtisadiyyat İnstitutunda “Regionlarda kiçik sahibkarlıq: imkanlar və çətinliklər” mövzusunda seminar keçirilib.",
    "",
    "Seminarda İqtisadi nəzəriyyə kafedrasının müəllimi Tural Məmmədov Gəncə və ətraf rayonlarda kiçik müəssisələrin maliyyəyə çıxışı ilə bağlı apardığı sorğunun ilkin nəticələrini təqdim edib. Sorğuda 120-dən çox sahibkar iştirak edib.",
    "",
    "Tural Məmmədovun sözlərinə görə, kiçik sahibkarların əksəriyyəti bank kreditindən çox, qohum və tanışlardan borc almağa üstünlük verir. Bunun əsas səbəbləri girov tələbləri və sənədləşmə ilə bağlı çətinliklərdir.",
    "",
    "Seminarda kafedranın müəllimləri, magistrantlar və yerli sahibkarlar iştirak ediblər. Tədbirin sonunda iştirakçıların sualları cavablandırılıb.",
  ),
  categories: ["discovery", "news"],
  nameForms: ["Tural Məmmədov"],
};

const extraction: Record<string, FixtureDocExtraction> = {
  [staffPage.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Staff page on the Ganja State Institute of Economics website.",
      source_type: "official_bio",
      page_language: "az",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Ganja State Institute of Economics",
        title: "müəllim",
        department: "Department of Economic Theory",
        english_rendering: "Lecturer",
        start: "2018",
        currency: "stated_current",
        supporting_excerpt:
          "Tural Məmmədov 2018-ci ildən Gəncə Dövlət İqtisadiyyat İnstitutunun İqtisadi nəzəriyyə kafedrasında müəllim kimi çalışır.",
      }),
      fact({
        category: "education",
        institution: "Ganja State Institute of Economics",
        qualification: "magistr",
        field: "iqtisadiyyat",
        english_rendering: "Master's degree, Economics",
        end: "2017",
        currency: "ended",
        supporting_excerpt: "Təhsili: 2017-ci ildə həmin institutda iqtisadiyyat ixtisası üzrə magistr dərəcəsi alıb.",
      }),
      fact({
        category: "location",
        place: "Ganja",
        place_scope: "work",
        currency: "stated_current",
        supporting_excerpt: "Gəncə Dövlət İqtisadiyyat İnstitutunun İqtisadi nəzəriyyə kafedrasında müəllim kimi çalışır",
      }),
    ],
  },
  [seminarNews.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Institute news item naming Tural Məmmədov as a lecturer in the Department of Economic Theory.",
      source_type: "news",
      page_language: "az",
      published_date: "2025-04-23",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Ganja State Institute of Economics",
        title: "müəllim",
        department: "Department of Economic Theory",
        english_rendering: "Lecturer",
        supporting_excerpt: "Seminarda İqtisadi nəzəriyyə kafedrasının müəllimi Tural Məmmədov",
      }),
    ],
    media: [
      media({
        headline: seminarNews.title,
        outlet: "Gəncə Dövlət İqtisadiyyat İnstitutu",
        kind: "article",
        published_date: "2025-04-23",
        event_date: "2025-04-22",
        language: "az",
        summary:
          "Institute news item: at a seminar on regional entrepreneurship, Məmmədov presented early results of his survey of more than 120 small-business owners around Ganja, who mostly borrow from relatives rather than banks because of collateral and paperwork requirements.",
        involvement: "Seminar presenter",
        coverage_type: "direct",
        topic: "event",
        identity_evidence: "Names him as a lecturer in the institute's Department of Economic Theory.",
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

const SEMINAR = { headlineContains: "regional sahibkarlığa" } as const;

export const turalMammadovLecturer: FixturePersonBundle = {
  person: {
    key: "tural-mammadov-lecturer",
    displayName: "Tural Mammadov",
    nativeName: "Tural Məmmədov",
    nameVariants: ["Tural Məmmədov", "Tural Mammadov"],
    organisation: "Ganja State Institute of Economics",
    role: "Lecturer in economics",
    location: "Ganja, Azerbaijan",
    summary: "Lecturer in the Department of Economic Theory at Ganja State Institute of Economics.",
    distinguishingFacts: [
      "Lecturer at Ganja State Institute of Economics since 2018",
      "Researches small-business access to finance around Ganja",
      "All sources found are in Azerbaijani",
    ],
    anchorDocKey: staffPage.key,
    scenarios: ["ambiguous"],
  },
  documents: [staffPage, seminarNews],
  extraction,
  synthesis: {
    1: {
      summary: [
        {
          text: "Tural Məmmədov (Tural Mammadov) has been a lecturer in the Department of Economic Theory at Ganja State Institute of Economics since 2018.",
          claims: [{ category: "employment", contains: "Lecturer" }],
          media: [],
          kind: "sourced",
        },
        {
          text: "He received a master's degree in economics from the same institute in 2017.",
          claims: [{ category: "education", contains: "Ganja State Institute of Economics" }],
          media: [],
          kind: "sourced",
        },
        {
          text: "In April 2025 he presented early results of a survey of more than 120 small-business owners in and around Ganja on their access to finance.",
          claims: [],
          media: [SEMINAR],
          kind: "sourced",
        },
      ],
      keyDevelopments: [
        {
          text: "Presented preliminary survey findings on small-business finance at an institute seminar on regional entrepreneurship.",
          claims: [],
          media: [SEMINAR],
          date: "2025-04-22",
        },
      ],
      gaps: [
        "The staff page mentions more than 15 academic articles, but no list of his publications was found.",
        "No personal professional contact route was found; the staff page refers enquiries to the institute's contact form.",
        "Two other people named Tural Mammadov appear in search results; only sources naming Ganja State Institute of Economics were used.",
      ],
      questions: [
        {
          question: "What were the main findings of his survey of small businesses' access to finance around Ganja, and will the full results be published?",
          claims: [],
          media: [SEMINAR],
        },
      ],
    },
  },
};
