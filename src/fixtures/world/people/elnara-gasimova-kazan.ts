import type { FixtureDocument, FixturePersonBundle } from "@/fixtures/types";
import { fact, lines, media, source } from "@/fixtures/world/helpers";

/**
 * Эльнара Гасымова — a paediatrician in Kazan (fictional). Same name as the
 * Caspian Lantern Analytics co-founder, different person. Both documents are
 * in "discovery" so a name search returns both people; the co-founder's
 * bundle has no extraction entries for them (they read as "not about her").
 */

const staffPage: FixtureDocument = {
  key: "volga-health-centre-gasymova-staff",
  url: "https://volga-childrens-health.example/vrachi/gasymova-elnara",
  title: "Эльнара Гасымова — врач-педиатр | Детский центр здоровья «Волга»",
  publisher: "Детский центр здоровья «Волга»",
  language: "ru",
  sourceType: "official_bio",
  publishedDate: null,
  access: "read",
  snippet:
    "Гасымова Эльнара Рашидовна — врач-педиатр высшей квалификационной категории, заведующая педиатрическим отделением Детского центра здоровья «Волга» (Казань).",
  body: lines(
    "Гасымова Эльнара Рашидовна",
    "",
    "Врач-педиатр высшей квалификационной категории, заведующая педиатрическим отделением Детского центра здоровья «Волга» (Казань).",
    "",
    "Стаж работы по специальности — 15 лет. В центре работает с 2016 года, педиатрическим отделением заведует с 2021 года.",
    "",
    "Основные направления работы: наблюдение детей раннего возраста, профилактика и вакцинация, ведение детей с хроническими заболеваниями органов дыхания.",
    "",
    "Участвует в программе наблюдения детей раннего возраста, которую центр ведёт с 2022 года, и проводит занятия для молодых родителей в «Школе здорового ребёнка».",
    "",
    "Принимает пациентов в основном корпусе центра. Запись на приём — через регистратуру или в разделе «Онлайн-запись» на сайте центра.",
  ),
  // "contacts" keeps her anchor reachable when research runs without a discovery step
  // (every other category for this name is already filled by the co-founder's documents).
  categories: ["discovery", "contacts"],
  nameForms: ["Эльнара Гасымова", "Гасымова Эльнара Рашидовна"],
};

const awardNews: FixtureDocument = {
  key: "infograd-kazan-volga-award",
  url: "https://infograd-kazan.example/news/2025/12/04/detskiy-centr-volga-premiya",
  title: "Детский центр здоровья «Волга» получил региональную премию за качество медицинской помощи",
  publisher: "Инфоград Казань",
  language: "ru",
  sourceType: "news",
  publishedDate: "2025-12-04",
  access: "read",
  snippet:
    "Детский центр здоровья «Волга» стал лауреатом региональной премии «Качество и забота». Заведующая педиатрическим отделением Эльнара Гасымова рассказала о программе наблюдения детей раннего возраста.",
  body: lines(
    "Детский центр здоровья «Волга» (Казань) стал лауреатом региональной премии «Качество и забота» в номинации «Амбулаторная помощь детям». Церемония награждения прошла 3 декабря.",
    "",
    "Жюри отметило программу наблюдения детей раннего возраста, которую центр ведёт с 2022 года. По данным центра, за это время в программе приняли участие более двух тысяч семей.",
    "",
    "«Нам важно, чтобы родители могли быстро получить консультацию и не тратить время на лишние визиты. Эта премия — заслуга всей команды отделения», — отметила заведующая педиатрическим отделением центра Эльнара Гасымова.",
    "",
    "Премия «Качество и забота» вручается медицинским организациям региона с 2018 года.",
  ),
  categories: ["discovery"],
  nameForms: ["Эльнара Гасымова"],
};

export const elnaraGasimovaKazan: FixturePersonBundle = {
  person: {
    key: "elnara-gasimova-kazan",
    displayName: "Elnara Gasimova",
    nativeName: "Эльнара Гасымова",
    nameVariants: ["Эльнара Гасымова", "Гасымова Эльнара Рашидовна", "Elnara Gasimova"],
    organisation: "Volga Children's Health Centre",
    role: "Paediatrician; head of the paediatric department",
    location: "Kazan, Russia",
    summary: "Paediatrician and head of the paediatric department at the Volga Children's Health Centre in Kazan.",
    distinguishingFacts: [
      "Paediatrician at the Volga Children's Health Centre, Kazan, since 2016",
      "Head of the centre's paediatric department since 2021",
      "All sources found are in Russian",
    ],
    anchorDocKey: staffPage.key,
    scenarios: ["same-name-collision", "sparse"],
  },
  documents: [staffPage, awardNews],
  extraction: {
    [staffPage.key]: {
      source: source({
        about_subject: "yes",
        identity_evidence: "Staff profile on the Volga Children's Health Centre website.",
        source_type: "official_bio",
        page_language: "ru",
      }),
      facts: [
        fact({
          category: "employment",
          organisation: "Volga Children's Health Centre",
          title: "врач-педиатр",
          english_rendering: "Paediatrician",
          start: "2016",
          currency: "stated_current",
          supporting_excerpt: "Врач-педиатр высшей квалификационной категории...В центре работает с 2016 года",
        }),
        fact({
          category: "employment",
          organisation: "Volga Children's Health Centre",
          title: "заведующая педиатрическим отделением",
          english_rendering: "Head of the Paediatric Department",
          start: "2021",
          currency: "stated_current",
          supporting_excerpt: "педиатрическим отделением заведует с 2021 года",
        }),
        fact({
          category: "location",
          place: "Kazan",
          place_scope: "work",
          currency: "stated_current",
          supporting_excerpt: "заведующая педиатрическим отделением Детского центра здоровья «Волга» (Казань)",
        }),
      ],
    },
    [awardNews.key]: {
      source: source({
        about_subject: "yes",
        identity_evidence: "Quotes Эльнара Гасымова as head of the paediatric department of the Volga Children's Health Centre.",
        source_type: "news",
        page_language: "ru",
        published_date: "2025-12-04",
      }),
      facts: [
        fact({
          category: "employment",
          organisation: "Volga Children's Health Centre",
          title: "заведующая педиатрическим отделением",
          english_rendering: "Head of the Paediatric Department",
          supporting_excerpt: "отметила заведующая педиатрическим отделением центра Эльнара Гасымова",
        }),
      ],
      media: [
        media({
          headline: awardNews.title,
          outlet: "Инфоград Казань",
          kind: "article",
          published_date: "2025-12-04",
          event_date: "2025-12-03",
          language: "ru",
          summary:
            "Local news report that the Volga Children's Health Centre in Kazan won a regional quality award for its early-childhood monitoring programme. Gasimova is quoted as head of the paediatric department, crediting her team.",
          involvement: "Quoted as head of the paediatric department",
          coverage_type: "organisation",
          topic: "award",
          identity_evidence: "Names her as head of the centre's paediatric department.",
        }),
      ],
    },
  },
  synthesis: {
    1: {
      summary: [
        {
          text: "Elnara Gasimova (Эльнара Гасымова) is a paediatrician at the Volga Children's Health Centre in Kazan, where she has worked since 2016 and has headed the paediatric department since 2021.",
          claims: [
            { category: "employment", contains: "Paediatrician" },
            { category: "employment", contains: "Head of the Paediatric Department" },
            { category: "location", contains: "Kazan" },
          ],
          media: [],
          kind: "sourced",
        },
        {
          text: "In December 2025 the centre received a regional quality award for its early-childhood monitoring programme, and she was quoted as head of the department.",
          claims: [],
          media: [{ headlineContains: "региональную премию" }],
          kind: "sourced",
        },
      ],
      keyDevelopments: [
        {
          text: "The Volga Children's Health Centre won the regional “Quality and Care” award for outpatient children's care.",
          claims: [],
          media: [{ headlineContains: "региональную премию" }],
          date: "2025-12-03",
        },
      ],
      gaps: [
        "No published education history was found.",
        "Only two sources were found, both in Russian and both connected to her employer.",
        "No professional publications, conference appearances or board roles were found.",
      ],
      questions: [
        {
          question: "How is the centre's early-childhood monitoring programme organised, and what has it changed for families since 2022?",
          claims: [],
          media: [{ headlineContains: "региональную премию" }],
        },
      ],
    },
  },
};
