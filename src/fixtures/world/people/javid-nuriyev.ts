import type { FixtureDocExtraction, FixtureDocument, FixturePersonBundle } from "@/fixtures/types";
import { fact, lines, media, source } from "@/fixtures/world/helpers";

/**
 * Javid Nuriyev — partial provider failure (fictional). News searches time
 * out in the first job and succeed on retry; his two news articles are only
 * reachable through news searches, so the first snapshot lacks them and the
 * synthesis sentence grounded in them is dropped automatically.
 */

const leadershipPage: FixtureDocument = {
  key: "shirvan-cloudworks-leadership",
  url: "https://shirvancloudworks.example/company/leadership",
  title: "Leadership | Shirvan Cloudworks",
  publisher: "Shirvan Cloudworks",
  language: "en",
  sourceType: "company_site",
  publishedDate: null,
  access: "read",
  snippet:
    "Shirvan Cloudworks leadership: Nigar Hasanzade (Chief Executive Officer), Javid Nuriyev (Chief Technology Officer) and Elvin Yusifli (Chief Financial Officer).",
  body: lines(
    "Leadership",
    "",
    "Shirvan Cloudworks provides managed cloud infrastructure and data-centre services to businesses in Azerbaijan from two facilities near Baku. Our leadership team is based at our head office in Baku.",
    "",
    "Nigar Hasanzade — Chief Executive Officer",
    "Nigar founded Shirvan Cloudworks in 2017 after a decade in the telecommunications industry.",
    "",
    "Javid Nuriyev — Chief Technology Officer",
    "Javid joined Shirvan Cloudworks as Chief Technology Officer in 2021. He is responsible for the company's platform architecture, security engineering and data-centre operations. Before joining, he led platform engineering at Nargin Systems Integration.",
    "",
    "Elvin Yusifli — Chief Financial Officer",
    "Elvin joined the company in 2019 from the audit practice of a regional accounting firm.",
    "",
    "For press enquiries, please use the contact page.",
  ),
  categories: ["discovery", "career"],
  nameForms: ["Javid Nuriyev"],
};

const previousEmployerPage: FixtureDocument = {
  key: "nargin-systems-leadership-update-2021",
  url: "https://narginsystems.example/news/2021/leadership-update-platform-engineering",
  title: "Leadership update: Javid Nuriyev to join Shirvan Cloudworks",
  publisher: "Nargin Systems Integration",
  language: "en",
  sourceType: "company_site",
  publishedDate: "2021-02-26",
  access: "read",
  snippet:
    "Javid Nuriyev, Head of Platform Engineering at Nargin Systems Integration since 2016, will leave at the end of March to become Chief Technology Officer of Shirvan Cloudworks.",
  body: lines(
    "Leadership update",
    "",
    "Javid Nuriyev, who has led our platform engineering team since 2016, will leave Nargin Systems Integration at the end of March to become Chief Technology Officer of Shirvan Cloudworks.",
    "",
    "During his five years as Head of Platform Engineering, Javid built the team from four engineers to more than thirty and led the migration of our managed-services customers to a common automation platform.",
    "",
    "Rashad Abdullayev, currently a principal engineer, will succeed Javid as Head of Platform Engineering from 1 April 2021.",
    "",
    "“Javid leaves behind a strong team and a platform our customers rely on every day,” said managing director Ulviyya Karimli. “We thank him and wish him every success.”",
    "",
    "Nargin Systems Integration is a Baku-based IT services company founded in 2009.",
  ),
  categories: ["discovery", "career"],
  nameForms: ["Javid Nuriyev"],
};

const azLaunchNews: FixtureDocument = {
  key: "texnoxeber-shirvan-platform",
  url: "https://texnoxeber.example/2025/06/11/shirvan-cloudworks-yerli-bulud-platformasi",
  title: "Shirvan Cloudworks yerli bulud platformasını təqdim edib",
  publisher: "TexnoXəbər",
  language: "az",
  sourceType: "news",
  publishedDate: "2025-06-11",
  access: "read",
  snippet:
    "Shirvan Cloudworks məlumatlarını ölkə daxilində saxlamaq istəyən müəssisələr üçün “Shirvan Platform” bulud xidmətini təqdim edib. Layihə barədə şirkətin texnologiya direktoru Cavid Nuriyev danışıb.",
  body: lines(
    "Bakıda fəaliyyət göstərən Shirvan Cloudworks şirkəti məlumatlarını ölkə daxilində saxlamaq istəyən müəssisələr üçün “Shirvan Platform” adlı yeni bulud xidmətini istifadəyə verib.",
    "",
    "Şirkətin texnologiya direktoru Cavid Nuriyev bildirib ki, platforma virtual serverləri, idarə olunan məlumat bazalarını və ehtiyat nüsxələrin saxlanması xidmətini bir yerdə birləşdirir. Onun sözlərinə görə, bütün məlumatlar şirkətin Bakı yaxınlığındakı iki məlumat mərkəzində saxlanılır.",
    "",
    "“Banklar və dövlət qurumları ilə işləyən şirkətlər üçün məlumatın harada saxlandığı çox vacibdir. Biz onlara tanış alətləri yerli infrastruktur üzərində təklif edirik”, — deyə Cavid Nuriyev qeyd edib.",
    "",
    "Platformanın ilk müştəriləri arasında logistika və pərakəndə ticarət şirkətləri var. Şirkət ilin sonunadək Gəncədə üçüncü məlumat mərkəzini açmağı planlaşdırır.",
  ),
  categories: ["news"],
  nameForms: ["Cavid Nuriyev"],
};

const ruLaunchNews: FixtureDocument = {
  key: "kaspiy-tech-shirvan-platform",
  url: "https://kaspiy-tech.example/news/2025/06/12/shirvan-cloudworks-platforma",
  title: "Shirvan Cloudworks запустила облачную платформу с хранением данных в Азербайджане",
  publisher: "Каспий Тех",
  language: "ru",
  sourceType: "news",
  publishedDate: "2025-06-12",
  access: "read",
  snippet:
    "Бакинский облачный провайдер Shirvan Cloudworks представил сервис Shirvan Platform. Технический директор компании Джавид Нуриев рассказал, для каких клиентов он предназначен.",
  body: lines(
    "Бакинская компания Shirvan Cloudworks запустила облачный сервис Shirvan Platform для организаций, которым важно хранить данные на территории Азербайджана.",
    "",
    "Как рассказал технический директор компании Джавид Нуриев, платформа объединяет виртуальные серверы, управляемые базы данных и резервное копирование. Все данные размещаются в двух дата-центрах компании под Баку.",
    "",
    "«Многие наши клиенты работают с банками и госструктурами, и для них принципиально, где физически находятся данные. Мы предлагаем привычные инструменты, но на местной инфраструктуре», — отметил Джавид Нуриев.",
    "",
    "Среди первых клиентов платформы — логистические и розничные компании. До конца года Shirvan Cloudworks планирует открыть третий дата-центр в Гяндже. Компания работает на рынке с 2017 года.",
  ),
  categories: ["news"],
  nameForms: ["Джавид Нуриев"],
};

const LAUNCH_SUMMARY_AZ =
  "Azerbaijani-language report on the launch of Shirvan Platform, a cloud service that keeps customer data in Azerbaijan. Nuriyev explains what the platform combines and why data location matters to clients working with banks and public bodies.";
const LAUNCH_SUMMARY_RU =
  "Russian-language report on the Shirvan Platform launch. Nuriyev describes the service and its two data centres near Baku; the company plans a third data centre in Ganja.";

const extraction: Record<string, FixtureDocExtraction> = {
  [leadershipPage.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Leadership page on the Shirvan Cloudworks website.",
      source_type: "company_site",
      page_language: "en",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Shirvan Cloudworks",
        title: "Chief Technology Officer",
        start: "2021",
        currency: "stated_current",
        supporting_excerpt:
          "Javid joined Shirvan Cloudworks as Chief Technology Officer in 2021. He is responsible for the company's platform architecture, security engineering and data-centre operations.",
      }),
      fact({
        category: "employment",
        organisation: "Nargin Systems Integration",
        title: "Head of Platform Engineering",
        currency: "ended",
        supporting_excerpt: "Before joining, he led platform engineering at Nargin Systems Integration.",
      }),
      fact({
        category: "location",
        place: "Baku",
        place_scope: "work",
        currency: "stated_current",
        supporting_excerpt: "Our leadership team is based at our head office in Baku.",
      }),
    ],
  },
  [previousEmployerPage.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Former employer's announcement of his move to Shirvan Cloudworks.",
      source_type: "company_site",
      page_language: "en",
      published_date: "2021-02-26",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Nargin Systems Integration",
        title: "Head of Platform Engineering",
        start: "2016",
        end: "2021-03",
        currency: "ended",
        supporting_excerpt:
          "Javid Nuriyev, who has led our platform engineering team since 2016, will leave Nargin Systems Integration at the end of March to become Chief Technology Officer of Shirvan Cloudworks.",
      }),
    ],
  },
  [azLaunchNews.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Names Cavid Nuriyev as chief technology officer of Shirvan Cloudworks.",
      source_type: "news",
      page_language: "az",
      published_date: "2025-06-11",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Shirvan Cloudworks",
        title: "texnologiya direktoru",
        english_rendering: "Chief Technology Officer",
        supporting_excerpt: "Şirkətin texnologiya direktoru Cavid Nuriyev bildirib ki",
      }),
    ],
    media: [
      media({
        headline: azLaunchNews.title,
        outlet: "TexnoXəbər",
        kind: "article",
        published_date: "2025-06-11",
        language: "az",
        summary: LAUNCH_SUMMARY_AZ,
        involvement: "Presented the platform; quoted as chief technology officer",
        coverage_type: "direct",
        topic: "business",
        identity_evidence: "Names him as chief technology officer of Shirvan Cloudworks.",
      }),
    ],
  },
  [ruLaunchNews.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Names Джавид Нуриев as technical director of Shirvan Cloudworks.",
      source_type: "news",
      page_language: "ru",
      published_date: "2025-06-12",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Shirvan Cloudworks",
        title: "технический директор",
        english_rendering: "Chief Technology Officer",
        supporting_excerpt: "Как рассказал технический директор компании Джавид Нуриев",
      }),
    ],
    media: [
      media({
        headline: ruLaunchNews.title,
        outlet: "Каспий Тех",
        kind: "article",
        published_date: "2025-06-12",
        language: "ru",
        summary: LAUNCH_SUMMARY_RU,
        involvement: "Quoted as technical director",
        coverage_type: "direct",
        topic: "business",
        identity_evidence: "Names him as technical director of Shirvan Cloudworks.",
      }),
    ],
  },
};

const CTO = { category: "employment", contains: "Chief Technology Officer" } as const;
const NARGIN = { category: "employment", contains: "Head of Platform Engineering" } as const;
const AZ_LAUNCH = { headlineContains: "bulud platformasını" } as const;
const RU_LAUNCH = { headlineContains: "облачную платформу" } as const;

export const javidNuriyev: FixturePersonBundle = {
  person: {
    key: "javid-nuriyev",
    displayName: "Javid Nuriyev",
    nativeName: "Cavid Nuriyev",
    nameVariants: ["Javid Nuriyev", "Cavid Nuriyev", "Джавид Нуриев"],
    organisation: "Shirvan Cloudworks",
    role: "Chief Technology Officer",
    location: "Baku, Azerbaijan",
    summary: "Chief technology officer of Shirvan Cloudworks, a cloud infrastructure provider based in Baku.",
    distinguishingFacts: [
      "Chief Technology Officer of Shirvan Cloudworks since 2021",
      "Previously Head of Platform Engineering at Nargin Systems Integration",
      "Based at the company's head office in Baku",
    ],
    anchorDocKey: leadershipPage.key,
    scenarios: ["partial-failure"],
    failures: [{ category: "news", kind: "timeout", untilRetry: true }],
  },
  documents: [leadershipPage, previousEmployerPage, azLaunchNews, ruLaunchNews],
  extraction,
  synthesis: {
    1: {
      summary: [
        {
          text: "Javid Nuriyev has been Chief Technology Officer of Shirvan Cloudworks, a Baku-based cloud infrastructure provider, since 2021, responsible for platform architecture, security engineering and data-centre operations.",
          claims: [CTO],
          media: [],
          kind: "sourced",
        },
        {
          text: "From 2016 to 2021 he was Head of Platform Engineering at Nargin Systems Integration, where he grew the team from four engineers to more than thirty.",
          claims: [NARGIN],
          media: [],
          kind: "sourced",
        },
        {
          text: "In June 2025 Shirvan Cloudworks launched Shirvan Platform, a cloud service that keeps data in Azerbaijan, and Nuriyev presented it in Azerbaijani- and Russian-language coverage.",
          claims: [],
          media: [AZ_LAUNCH, RU_LAUNCH],
          kind: "sourced",
        },
      ],
      keyDevelopments: [
        {
          text: "Shirvan Cloudworks launched Shirvan Platform, with data stored in two data centres near Baku and a third planned in Ganja.",
          claims: [],
          media: [AZ_LAUNCH, RU_LAUNCH],
          date: "2025-06-11",
        },
        {
          text: "Joined Shirvan Cloudworks as Chief Technology Officer after five years leading platform engineering at Nargin Systems Integration.",
          claims: [CTO, NARGIN],
          media: [],
          date: "2021",
        },
      ],
      gaps: [
        "No published education history was found.",
        "No talks, publications or board roles were found.",
      ],
      questions: [
        {
          question: "How has demand for Shirvan Platform developed since its launch, and how far along is the planned data centre in Ganja?",
          claims: [],
          media: [AZ_LAUNCH],
        },
        {
          question: "Which lessons from scaling the platform engineering team at Nargin Systems Integration has he applied at Shirvan Cloudworks?",
          claims: [NARGIN],
          media: [],
        },
      ],
    },
  },
};
