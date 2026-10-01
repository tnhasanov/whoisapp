import type {
  ClaimSelector,
  FixtureDocExtraction,
  FixtureDocument,
  FixturePersonBundle,
  FixtureSynthesis,
  MediaSelector,
} from "@/fixtures/types";
import { fact, lines, media, relationship, source } from "@/fixtures/world/helpers";

/**
 * Elnara Gasimova — co-founder of Caspian Lantern Analytics (fictional).
 *
 * Scenarios: rich profile, AZ/RU/EN spellings, a conflicting start year
 * (2014 vs 2015, corrected in world version 2), a syndicated funding story,
 * login-walled and paywalled sources, a hostile forum page, a people-search
 * aggregator, and a refresh (version 2) in which she becomes Executive Chair.
 *
 * Search budget note: the fixture search returns the first N matching
 * documents of a category in world order (8 for discovery, 6 per research
 * query), so each category below holds at most six documents per version.
 */

const BIO_URL = "https://caspianlantern.example/team/elnara-gasimova";
const CONTACT_URL = "https://caspianlantern.example/contact";
const PROGRAMME_URL = "https://caspian-energy-data.example/2019/programme/elnara-gasimova";

/* --------------------------------- Shared text --------------------------------- */

const BIO_COMPANY =
  "Caspian Lantern Analytics builds forecasting and data-quality tools for energy, logistics and public-sector clients, with its headquarters in Baku and an office in London. Elnara is based in Baku and regularly works from the London office.";
const BIO_CAREER =
  "Before founding Caspian Lantern, Elnara spent five years at Absheron Grid Partners, an energy-systems consultancy. She joined the firm in 2014 as a Senior Analyst and served as Head of Research from 2017 to 2019, leading work on demand forecasting and grid balancing.";
const BIO_BOARD =
  "Since 2022 she has served on the board of the Baku Data Commons Foundation, a non-profit that publishes open datasets for researchers and journalists. She is a co-author of the 2021 report “Grid Flexibility in the South Caucasus”.";
const BIO_EDUCATION = "Elnara holds a BSc in Applied Mathematics from the Western Caspian Institute of Technology (2012).";
const BIO_LINKS = [
  "Elsewhere online",
  "Professional profile: linkedin.example/in/elnara-gasimova",
  "Personal website: elnaragasimova.example",
  "",
  "Media and speaking requests: please contact our press office through the contact page.",
];

const SERIES_B_HEADLINE = "Caspian Lantern Analytics raises $18 million in Series B round";
const SERIES_B_BODY = [
  "Caspian Lantern Analytics, a Baku-based developer of forecasting and data-quality software for utilities and logistics operators, has raised $18 million in a Series B financing round.",
  "",
  "The round was led by Silk Meridian Ventures, with participation from existing investors Caravel Seed Partners and North Quay Capital. The company said it would use the funding to expand its engineering team in Baku, grow its London office and launch its data-quality product in Central Asia.",
  "",
  "“Utilities are being asked to make faster decisions with more volatile demand,” said Elnara Gasimova, co-founder and chief executive of Caspian Lantern Analytics. “This investment lets us hire the engineers we need and bring our audit tools to more operators in the region.”",
  "",
  "Caspian Lantern Analytics was founded in 2019 and employs about 70 people in Baku and London. The company did not disclose its valuation.",
  "",
  "The round follows a $4.5 million Series A in 2022.",
];
const SERIES_B_SNIPPET =
  "Baku-based Caspian Lantern Analytics has raised $18 million in a Series B round led by Silk Meridian Ventures, chief executive Elnara Gasimova said, with plans to grow its London office and enter Central Asia.";

/* ---------------------------------- Documents ---------------------------------- */

const officialBioV1: FixtureDocument = {
  key: "gasimova-official-bio-v1",
  url: BIO_URL,
  title: "Elnara Gasimova — Co-founder and Chief Executive Officer | Caspian Lantern Analytics",
  publisher: "Caspian Lantern Analytics",
  language: "en",
  sourceType: "official_bio",
  publishedDate: null,
  access: "read",
  snippet:
    "Elnara Gasimova is co-founder and Chief Executive Officer of Caspian Lantern Analytics, the Baku-based data-analytics company she launched in 2019. Before founding the company she spent five years at Absheron Grid Partners.",
  body: lines(
    "Elnara Gasimova",
    "Co-founder and Chief Executive Officer",
    "",
    "Elnara Gasimova is co-founder and Chief Executive Officer of Caspian Lantern Analytics. She co-founded the company in Baku in 2019 with Rauf Sadigov and has led it as CEO since then.",
    "",
    BIO_COMPANY,
    "",
    BIO_CAREER,
    "",
    BIO_BOARD,
    "",
    BIO_EDUCATION,
    "",
    ...BIO_LINKS,
  ),
  categories: ["discovery", "career"],
  nameForms: ["Elnara Gasimova"],
  versions: [1],
};

const officialBioV2: FixtureDocument = {
  key: "gasimova-official-bio-v2",
  url: BIO_URL,
  title: "Elnara Gasimova — Co-founder and Executive Chair | Caspian Lantern Analytics",
  publisher: "Caspian Lantern Analytics",
  language: "en",
  sourceType: "official_bio",
  publishedDate: null,
  access: "read",
  snippet:
    "Elnara Gasimova is co-founder and Executive Chair of Caspian Lantern Analytics. She led the Baku-based data-analytics company as Chief Executive Officer from 2019 until September 2026.",
  body: lines(
    "Elnara Gasimova",
    "Co-founder and Executive Chair",
    "",
    "Elnara Gasimova is co-founder and Executive Chair of Caspian Lantern Analytics. She co-founded the company in Baku in 2019 with Rauf Sadigov and served as Chief Executive Officer from 2019 until September 2026, when she became Executive Chair and Rauf Sadigov succeeded her as CEO. As Executive Chair she leads the board and focuses on partnerships and the company's growth in the United Kingdom.",
    "",
    BIO_COMPANY,
    "",
    BIO_CAREER,
    "",
    BIO_BOARD,
    "",
    BIO_EDUCATION,
    "",
    ...BIO_LINKS,
  ),
  categories: ["discovery", "career"],
  nameForms: ["Elnara Gasimova"],
  versions: [2],
};

const aboutPage: FixtureDocument = {
  key: "caspian-lantern-about",
  url: "https://caspianlantern.example/about",
  title: "About us | Caspian Lantern Analytics",
  publisher: "Caspian Lantern Analytics",
  language: "en",
  sourceType: "company_site",
  publishedDate: null,
  access: "read",
  snippet:
    "Caspian Lantern Analytics was founded in Baku in 2019 by Elnara Gasimova and Rauf Sadigov. The company builds forecasting and data-quality tools for energy, logistics and public-sector clients.",
  body: lines(
    "About Caspian Lantern Analytics",
    "",
    "Caspian Lantern Analytics was founded in Baku in 2019 by Elnara Gasimova and Rauf Sadigov. The two co-founders set out to give energy and logistics operators in the region forecasting tools built on well-documented, auditable data.",
    "",
    "Today the company employs around 70 people. Its products include Lantern Forecast, a demand-forecasting service for utilities, and Lantern Audit, which checks the quality and lineage of operational datasets. Clients include grid operators, port authorities and municipal agencies in the South Caucasus and Central Asia.",
    "",
    "Milestones",
    "2019: company founded in Baku.",
    "2021: first utility contract signed; the team grows to 25.",
    "2022: Series A financing.",
    "2024: London office opens to serve clients in the United Kingdom and Europe.",
    "2025: Series B financing.",
    "",
    "How we work",
    "We publish how our models are built and validated, we keep client data in the jurisdiction where it was collected, and, where clients agree, we contribute anonymised datasets to open-data initiatives.",
    "",
    "Head office: Baku, Azerbaijan. Second office: London, United Kingdom.",
  ),
  categories: ["connections"],
  nameForms: ["Elnara Gasimova"],
};

function contactBody(officeLabel: string): string {
  return lines(
    "Contact us",
    "",
    "General enquiries",
    "Head office: Baku, Azerbaijan",
    "London office reception: +44 20 7946 0321 (Monday to Friday, 09:00 to 17:30 UK time)",
    `Enquiry form: ${CONTACT_URL}#enquiry-form`,
    "",
    "Media",
    "Press office: press@caspianlantern.example",
    "We aim to answer media requests within one working day.",
    "",
    officeLabel,
    "Leyla Hüseynzadə, Executive Assistant to Elnara Gasimova",
    "Telephone: +44 20 7946 0358",
    `Meeting and speaking requests for Elnara Gasimova are handled by the ${officeLabel}.`,
    "",
    "Careers",
    "Current vacancies are listed on our careers page. We do not accept unsolicited CVs from agencies.",
    "",
    "Please do not send confidential information through this page.",
  );
}

const contactPageV1: FixtureDocument = {
  key: "caspian-lantern-contact-v1",
  url: CONTACT_URL,
  title: "Contact | Caspian Lantern Analytics",
  publisher: "Caspian Lantern Analytics",
  language: "en",
  sourceType: "company_site",
  publishedDate: null,
  access: "read",
  snippet:
    "Contact Caspian Lantern Analytics: London office reception +44 20 7946 0321, press office press@caspianlantern.example, and the Office of the CEO for meeting requests.",
  body: contactBody("Office of the CEO"),
  categories: ["contacts"],
  nameForms: ["Elnara Gasimova"],
  versions: [1],
};

const contactPageV2: FixtureDocument = {
  key: "caspian-lantern-contact-v2",
  url: CONTACT_URL,
  title: "Contact | Caspian Lantern Analytics",
  publisher: "Caspian Lantern Analytics",
  language: "en",
  sourceType: "company_site",
  publishedDate: null,
  access: "read",
  snippet:
    "Contact Caspian Lantern Analytics: London office reception +44 20 7946 0321, press office press@caspianlantern.example, and the Office of the Executive Chair for meeting requests.",
  body: contactBody("Office of the Executive Chair"),
  categories: ["contacts"],
  nameForms: ["Elnara Gasimova"],
  versions: [2],
};

const personalSite: FixtureDocument = {
  key: "gasimova-personal-site",
  url: "https://elnaragasimova.example/",
  title: "Elnara Gasimova — data infrastructure, forecasting and open data",
  publisher: "Elnara Gasimova (personal website)",
  language: "en",
  sourceType: "personal_site",
  publishedDate: null,
  access: "read",
  snippet:
    "I'm Elnara Gasimova, co-founder of Caspian Lantern Analytics. I write and speak about data infrastructure, forecasting and open data in the Caspian region.",
  body: lines(
    "Hello, I'm Elnara Gasimova.",
    "",
    "I co-founded Caspian Lantern Analytics in 2019 and I am based in Baku, with regular stretches in London. My work sits where data engineering meets public infrastructure: forecasting electricity demand, auditing operational datasets and making useful data available to people outside the organisations that collect it.",
    "",
    "Writing",
    "Why forecasting teams need data contracts (2025)",
    "Open data for grid planning: lessons from the South Caucasus (2023)",
    "Grid Flexibility in the South Caucasus, a report co-authored with Martin Ellery (2021)",
    "",
    "Speaking",
    "I speak at a small number of conferences and university events each year, usually on data quality, energy forecasting or building technical teams in the region. For speaking and professional enquiries, please call or message +44 7700 900417. I do not take sales calls on this number.",
    "",
    "Elsewhere",
    "Short posts: x.example/elnara_builds",
    "Professional profile: linkedin.example/in/elnara-gasimova",
    "",
    "Last updated February 2026.",
  ),
  categories: ["contacts"],
  nameForms: ["Elnara Gasimova"],
};

const summitSpeakerPage: FixtureDocument = {
  key: "eurasia-data-summit-2025-gasimova",
  url: "https://eurasiadatasummit.example/2025/speakers/elnara-gasimova",
  title: "Elnara Gasimova | Speakers | Eurasia Data Leaders Summit 2025",
  publisher: "Eurasia Data Leaders Summit",
  language: "en",
  sourceType: "conference",
  publishedDate: "2025-04-22",
  access: "read",
  snippet:
    "Elnara Gasimova, co-founder and CEO of Caspian Lantern Analytics, speaks on the panel “Who owns the forecast?” at the Eurasia Data Leaders Summit 2025 in Tbilisi.",
  body: lines(
    "Eurasia Data Leaders Summit 2025",
    "Tbilisi, 3–4 June 2025",
    "",
    "Speaker: Elnara Gasimova",
    "Co-founder and CEO, Caspian Lantern Analytics (Baku)",
    "",
    "Session: Who owns the forecast? Accountability in data-driven infrastructure",
    "Day 1, Main Hall, 11:30–12:15",
    "",
    "Elnara Gasimova co-founded Caspian Lantern Analytics, which builds forecasting and data-quality tools for utilities and logistics operators. On this panel she will discuss how operators and analytics vendors share responsibility when forecasts are used for operational decisions, and what documentation regulators should expect.",
    "",
    "Programme enquiries",
    "For questions about this session, the speaker has asked that programme enquiries be sent to e.gasimova@caspianlantern.example. Press accreditation requests should go to the summit media desk.",
    "",
    "Other speakers on this panel: representatives of two regional grid operators and a university research group, to be confirmed.",
  ),
  categories: ["contacts"],
  nameForms: ["Elnara Gasimova"],
};

const leadershipPressRelease: FixtureDocument = {
  key: "caspian-lantern-leadership-transition",
  url: "https://caspianlantern.example/news/leadership-transition",
  title: "Caspian Lantern Analytics appoints Rauf Sadigov as Chief Executive; Elnara Gasimova becomes Executive Chair",
  publisher: "Caspian Lantern Analytics",
  language: "en",
  sourceType: "press_release",
  publishedDate: "@run-date",
  access: "read",
  snippet:
    "Co-founder Rauf Sadigov has been appointed Chief Executive Officer of Caspian Lantern Analytics. Elnara Gasimova, who had led the company as CEO since 2019, becomes Executive Chair.",
  body: lines(
    "Press release",
    "",
    "Caspian Lantern Analytics appoints Rauf Sadigov as Chief Executive; Elnara Gasimova becomes Executive Chair",
    "",
    "Baku — Caspian Lantern Analytics today announced that its board has appointed co-founder Rauf Sadigov as Chief Executive Officer. Elnara Gasimova, who co-founded the company with him in 2019 and had led it as CEO since then, has become Executive Chair.",
    "",
    "The changes complete a leadership transition that began in September 2026. As Executive Chair, Gasimova will lead the board and focus on strategic partnerships and the company's growth in the United Kingdom. Sadigov, who has served as Chief Operating Officer since 2019, becomes responsible for day-to-day management.",
    "",
    "“Rauf and I started this company together, and he has run our operations from the first day,” said Elnara Gasimova. “This is the right moment for him to lead the business while I concentrate on our partners and the board.”",
    "",
    "“I am grateful for the trust of the board and of our team,” said Rauf Sadigov.",
    "",
    "Media contact: press@caspianlantern.example",
  ),
  categories: ["contacts"],
  nameForms: ["Elnara Gasimova"],
  versions: [2],
};

function programmeBody(joinedYear: string, correction: boolean): string {
  return lines(
    "Caspian Energy Data Conference 2019",
    "Baku, 24–25 October 2019",
    "",
    "Speaker profile: Elnara Gasimova",
    "",
    "Elnara Gasimova is co-founder of Caspian Lantern Analytics, a Baku start-up launched this year to build forecasting tools for energy and logistics operators.",
    "",
    `She joined Absheron Grid Partners in ${joinedYear} as a senior analyst and later led its research team, where her work focused on short-term demand forecasting and the integration of wind generation into the grid. She studied applied mathematics in Baku and data science in the United Kingdom.`,
    "",
    "Session: Forecasting demand when the data is incomplete",
    "Day 2, Hall B, 14:00–14:40",
    "",
    "In this session Elnara will present practical methods for building reliable demand forecasts from patchy meter data, with examples from municipal networks.",
    ...(correction
      ? [
          "",
          "Correction: An earlier version of this profile stated that Elnara Gasimova joined Absheron Grid Partners in 2015. She joined the firm in 2014, and the profile has been updated.",
        ]
      : []),
  );
}

const programmeV1: FixtureDocument = {
  key: "energy-data-conf-2019-gasimova-v1",
  url: PROGRAMME_URL,
  title: "Elnara Gasimova — Speaker | Caspian Energy Data Conference 2019",
  publisher: "Caspian Energy Data Conference",
  language: "en",
  sourceType: "conference",
  publishedDate: "2019-09-16",
  access: "read",
  snippet:
    "Speaker profile: Elnara Gasimova, co-founder of Caspian Lantern Analytics. She joined Absheron Grid Partners in 2015 as a senior analyst and later led its research team.",
  body: programmeBody("2015", false),
  categories: ["career"],
  nameForms: ["Elnara Gasimova"],
  versions: [1],
};

const programmeV2: FixtureDocument = {
  key: "energy-data-conf-2019-gasimova-v2",
  url: PROGRAMME_URL,
  title: "Elnara Gasimova — Speaker | Caspian Energy Data Conference 2019",
  publisher: "Caspian Energy Data Conference",
  language: "en",
  sourceType: "conference",
  publishedDate: "2019-09-16",
  access: "read",
  snippet:
    "Speaker profile (corrected): Elnara Gasimova, co-founder of Caspian Lantern Analytics. She joined Absheron Grid Partners in 2014 as a senior analyst and later led its research team.",
  body: programmeBody("2014", true),
  categories: ["career"],
  nameForms: ["Elnara Gasimova"],
  versions: [2],
};

const azCareerInterview: FixtureDocument = {
  key: "karyera-jurnali-gasimova-interview",
  url: "https://karyera-jurnali.example/musahibe/2021/03/elnare-qasimova",
  title: "Elnarə Qasımova: “Riyaziyyat mənə düzgün sual verməyi öyrətdi”",
  publisher: "Karyera Jurnalı",
  language: "az",
  sourceType: "interview",
  publishedDate: "2021-03-15",
  access: "read",
  snippet:
    "Caspian Lantern Analytics şirkətinin həmtəsisçisi Elnarə Qasımova təhsil yolundan, Böyük Britaniyadakı magistr təhsilindən və məlumat analitikasına necə gəldiyindən danışır.",
  body: lines(
    "Caspian Lantern Analytics şirkətinin həmtəsisçisi və baş icraçı direktoru Elnarə Qasımova ilə təhsil yolu, ilk iş təcrübəsi və gənc analitiklərə tövsiyələri barədə söhbət etdik.",
    "",
    "— Məlumat analitikasına necə gəldiniz?",
    "",
    "— Bakalavr təhsilimi Bakıda tətbiqi riyaziyyat üzrə almışam. Riyaziyyat mənə hər şeydən əvvəl düzgün sual verməyi öyrətdi. Sonra Böyük Britaniyaya getdim və 2013-cü ildə Northgate Universitetində məlumat elmi üzrə magistr dərəcəsi aldım. Elə orada ilk dəfə real enerji məlumatları ilə işlədim.",
    "",
    "— Vətənə qayıtdıqdan sonra işə haradan başladınız?",
    "",
    "— 2014-cü ildə baş analitik kimi Absheron Grid Partners şirkətinə qoşuldum. Əsasən elektrik enerjisinə tələbatın proqnozlaşdırılması ilə məşğul olurduq. Sonralar şirkətin tədqiqat şöbəsinə rəhbərlik etdim. O illər mənə həm texniki, həm də komanda idarəçiliyi baxımından çox şey verdi.",
    "",
    "— Gənc analitiklərə nə məsləhət görərdiniz?",
    "",
    "— Alətlərə deyil, məlumatın haradan gəldiyini anlamağa daha çox vaxt ayırsınlar. Ən yaxşı model belə pis məlumatı xilas edə bilməz. Bir də öz işlərini sadə dillə izah etməyi öyrənsinlər: qərarları çox vaxt mütəxəssis olmayan insanlar verir.",
    "",
    "— Bu gün Caspian Lantern Analytics-də hansı layihələr üzərində işləyirsiniz?",
    "",
    "— Kommunal xidmət şirkətləri üçün tələbat proqnozları və məlumat keyfiyyətini yoxlayan alətlər hazırlayırıq. Komandamızın böyük hissəsi Bakıda çalışır.",
  ),
  categories: ["career"],
  nameForms: ["Elnarə Qasımova"],
};

const appointment2017: FixtureDocument = {
  key: "caspian-energy-monitor-head-of-research-2017",
  url: "https://caspian-energy-monitor.example/2017/09/05/absheron-grid-partners-names-head-of-research",
  title: "Absheron Grid Partners names Elnara Gasimova head of research",
  publisher: "Caspian Energy Monitor",
  language: "en",
  sourceType: "news",
  publishedDate: "2017-09-05",
  access: "read",
  snippet:
    "Baku consultancy Absheron Grid Partners has named Elnara Gasimova as its head of research. Gasimova currently leads the firm's forecasting research team.",
  body: lines(
    "Absheron Grid Partners, a Baku-based energy-systems consultancy, has named Elnara Gasimova head of research, the firm announced on Monday.",
    "",
    "Gasimova, who joined the consultancy as a senior analyst, currently leads its forecasting research team, which works on short-term demand forecasting, grid balancing and the integration of wind generation. She will take up the new post on 1 October and will also join the firm's management committee.",
    "",
    "“Elnara has built our forecasting practice from the ground up,” said managing partner Kamran Valiyev. “Giving her responsibility for all of our research is the natural next step.”",
    "",
    "Gasimova holds degrees in applied mathematics and data science.",
    "",
    "Absheron Grid Partners advises utilities and regulators in the South Caucasus and employs around 40 people.",
  ),
  categories: ["career"],
  nameForms: ["Elnara Gasimova"],
};

const londonOffice: FixtureDocument = {
  key: "thames-data-weekly-london-office",
  url: "https://thamesdataweekly.example/2024/01/caspian-lantern-opens-london-office",
  title: "Caspian Lantern opens London office",
  publisher: "Thames Data Weekly",
  language: "en",
  sourceType: "news",
  publishedDate: "2024-01-20",
  // The provider reports a re-index date; the page itself shows 20 January 2024.
  providerPublishedDate: "2026-09-20",
  access: "read",
  snippet:
    "Baku-based Caspian Lantern Analytics has opened an office in London to serve utility and logistics clients in the UK and Europe, chief executive Elnara Gasimova said.",
  body: lines(
    "Caspian Lantern Analytics, a data-analytics company headquartered in Baku, has opened its first office outside Azerbaijan, in London.",
    "",
    "The office, in central London, will initially house a team of eight working on client delivery and on partnerships with UK utilities and logistics operators. The company plans to double the London team by the end of 2025.",
    "",
    "Chief executive Elnara Gasimova said the company had been serving British clients remotely for two years. “Being in London lets us work alongside our clients' engineers rather than across a video call,” she said. “Our product and engineering teams will remain in Baku.”",
    "",
    "Caspian Lantern Analytics was founded in 2019 and develops demand-forecasting and data-quality tools. Its clients include grid operators and port authorities in the South Caucasus and Central Asia.",
    "",
    "Published 20 January 2024.",
  ),
  categories: ["career"],
  nameForms: ["Elnara Gasimova"],
};

const boardPage: FixtureDocument = {
  key: "baku-data-commons-board",
  url: "https://bakudatacommons.example/about/board",
  title: "Board of Directors | Baku Data Commons Foundation",
  publisher: "Baku Data Commons Foundation",
  language: "en",
  sourceType: "company_site",
  publishedDate: null,
  access: "read",
  snippet:
    "The Baku Data Commons Foundation is governed by a volunteer board: Dr. Aynur Karimova (Chair), Elnara Gasimova, Prof. Martin Ellery and Samir Bagirzade.",
  body: lines(
    "Board of Directors",
    "",
    "The Baku Data Commons Foundation is a non-profit organisation that publishes open, documented datasets for researchers, journalists and civic groups. It is governed by a volunteer board of directors who serve three-year terms without remuneration.",
    "",
    "Dr. Aynur Karimova — Chair",
    "Economist and former head of a statistical research institute. Chair of the board since 2020.",
    "",
    "Elnara Gasimova — Director",
    "Co-founder of Caspian Lantern Analytics. Member of the board since 2022; leads the board's data-quality working group.",
    "",
    "Prof. Martin Ellery — Director",
    "Professor of Energy Systems at the University of Northgate. Member of the board since 2021.",
    "",
    "Samir Bagirzade — Director and Treasurer",
    "Chartered accountant. Member of the board since 2020.",
    "",
    "Minutes of board meetings and the foundation's annual accounts are published on this website.",
  ),
  categories: ["connections"],
  nameForms: ["Elnara Gasimova"],
};

const gridReport: FixtureDocument = {
  key: "northgate-grid-flexibility-report",
  url: "https://energy.northgate-university.example/publications/grid-flexibility-south-caucasus",
  title: "Grid Flexibility in the South Caucasus (2021) | Energy Systems Group, University of Northgate",
  publisher: "University of Northgate, Energy Systems Group",
  language: "en",
  sourceType: "academic",
  publishedDate: "2021-06",
  access: "read",
  snippet:
    "Report by Prof. Martin Ellery (University of Northgate) and Elnara Gasimova (Caspian Lantern Analytics) on technical and market options for making electricity grids in the South Caucasus more flexible.",
  body: lines(
    "Grid Flexibility in the South Caucasus",
    "Report, June 2021",
    "",
    "Authors: Prof. Martin Ellery (Energy Systems Group, University of Northgate) and Elnara Gasimova (Caspian Lantern Analytics)",
    "",
    "Summary",
    "Electricity systems across the South Caucasus are adding wind and solar generation faster than they are adding the flexibility needed to balance it. This report reviews the main options available to system operators — demand response, storage, cross-border trading and better short-term forecasting — and estimates how much each could contribute by 2030.",
    "",
    "The authors find that improved forecasting and data sharing between operators are the cheapest sources of flexibility in the near term, while storage becomes important once wind and solar exceed about a quarter of annual generation.",
    "",
    "The report was prepared with support from the Energy Systems Group's regional research fund. Ellery and Gasimova first worked together when Gasimova was a master's student in the group.",
    "",
    "Download: full report (PDF, 64 pages)",
    "Suggested citation: Ellery, M. and Gasimova, E. (2021). Grid Flexibility in the South Caucasus. University of Northgate, Energy Systems Group.",
  ),
  categories: ["connections"],
  nameForms: ["Elnara Gasimova"],
};

const alumniPage: FixtureDocument = {
  key: "absheron-grid-alumni",
  url: "https://absherongrid.example/about/alumni",
  title: "Alumni | Absheron Grid Partners",
  publisher: "Absheron Grid Partners",
  language: "en",
  sourceType: "company_site",
  publishedDate: null,
  access: "read",
  snippet:
    "Former colleagues of Absheron Grid Partners now work across the region's energy and data sector, including Elnara Gasimova (2014–2019) and Nicat Rzayev (2014–2018).",
  body: lines(
    "Our alumni",
    "",
    "Many people who started their careers at Absheron Grid Partners have gone on to lead teams across the region's energy and data sector. We stay in touch with them through our alumni network. A selection of alumni who have agreed to be listed:",
    "",
    "Elnara Gasimova (2014–2019) — Senior Analyst, then Head of Research. Co-founded Caspian Lantern Analytics in 2019.",
    "",
    "Nicat Rzayev (2014–2018) — Grid Modelling Engineer. Now a technical lead in power-system planning.",
    "",
    "Gunel Safarova (2020–2024) — Analyst, Regulatory Affairs. Now works in energy regulation.",
    "",
    "Former colleagues who would like to be listed, or to update their entry, can write to alumni@absherongrid.example.",
  ),
  categories: ["connections"],
  nameForms: ["Elnara Gasimova"],
};

const ruInterview: FixtureDocument = {
  key: "delovoy-kaspiy-gasimova-interview",
  url: "https://delovoy-kaspiy.example/interview/2024/06/18/elnara-gasymova",
  title: "Эльнара Гасымова: «Данные — это инфраструктура»",
  publisher: "Деловой Каспий",
  language: "ru",
  sourceType: "interview",
  publishedDate: "2024-06-18",
  access: "read",
  snippet:
    "Сооснователь и генеральный директор Caspian Lantern Analytics Эльнара Гасымова — о том, почему данные нужно строить как дороги и мосты, и о работе компании в Лондоне.",
  body: lines(
    "Компания Caspian Lantern Analytics, основанная в Баку в 2019 году, разрабатывает инструменты прогнозирования и контроля качества данных для энергетики и логистики. В январе она открыла офис в Лондоне. Мы поговорили с её сооснователем и генеральным директором Эльнарой Гасымовой.",
    "",
    "— Вы часто повторяете, что данные — это инфраструктура. Что вы имеете в виду?",
    "",
    "— Данные нужно строить и обслуживать так же, как дороги или электросети. Если у набора данных нет владельца, описания и истории изменений, на его основе нельзя принимать решения, какой бы точной ни казалась модель.",
    "",
    "— Зачем бакинской компании офис в Лондоне?",
    "",
    "— Там наши британские клиенты и партнёры. Но разработка остаётся в Баку: здесь работает большая часть команды.",
    "",
    "— С какими трудностями вы сталкиваетесь при найме?",
    "",
    "— Опытных инженеров данных в регионе пока немного. Поэтому мы много вкладываем в обучение: стажировки, совместные курсы с университетами, внутренние семинары.",
    "",
    "— Каким вы видите следующий этап?",
    "",
    "— Мы хотим, чтобы наши инструменты проверки качества данных стали стандартом для коммунальных компаний региона. И, конечно, продолжим участвовать в проектах открытых данных.",
    "",
    "Беседовал Глеб Ракитин",
  ),
  categories: ["discovery", "connections"],
  nameForms: ["Эльнара Гасымова", "Эльнарой Гасымовой"],
};

const azForumArticle: FixtureDocument = {
  key: "reqemsal-gundem-data-forum-2023",
  url: "https://reqemsalgundem.example/xeber/2023/11/02/baki-melumat-forumu",
  title: "Bakı Məlumat Forumunda açıq məlumatların gələcəyi müzakirə olunub",
  publisher: "Rəqəmsal Gündəm",
  language: "az",
  sourceType: "news",
  publishedDate: "2023-11-02",
  access: "read",
  snippet:
    "Bakı Məlumat Forumunda çıxış edən Caspian Lantern Analytics şirkətinin rəhbəri Elnarə Qasımova dövlət qurumlarını məlumatları açıq formatda dərc etməyə çağırıb.",
  body: lines(
    "Oktyabrın 31-də və noyabrın 1-də paytaxtda keçirilən Bakı Məlumat Forumunda dövlət qurumlarının, özəl şirkətlərin və universitetlərin nümayəndələri açıq məlumatların iqtisadiyyata təsirini müzakirə ediblər.",
    "",
    "Forumun “Açıq məlumat və şəffaf qərarlar” panelində çıxış edən Caspian Lantern Analytics şirkətinin həmtəsisçisi və baş icraçı direktoru Elnarə Qasımova bildirib ki, enerji və nəqliyyat sahələrində toplanan məlumatların böyük hissəsi hələ də yalnız qurumların daxilində qalır.",
    "",
    "“Məlumat açıq olanda ondan həm tədqiqatçılar, həm jurnalistlər, həm də kiçik şirkətlər faydalana bilir. Əsas şərt məlumatın keyfiyyətli olması və aydın təsvirlə dərc edilməsidir”, — deyə Elnarə Qasımova qeyd edib.",
    "",
    "O, həmçinin idarə heyətinin üzvü olduğu Baku Data Commons Foundation təşkilatının tədqiqatçılar və jurnalistlər üçün açıq məlumat dəstləri hazırladığını xatırladıb.",
    "",
    "Forumda iki gün ərzində 30-dan çox çıxış dinlənilib. Təşkilatçıların sözlərinə görə, tədbirdə 600-ə yaxın iştirakçı olub.",
  ),
  categories: ["discovery", "connections"],
  nameForms: ["Elnarə Qasımova"],
};

const seriesBBakuTechReview: FixtureDocument = {
  key: "series-b-baku-tech-review",
  url: "https://news.baku-tech-review.example/2025/03/12/caspian-lantern-analytics-series-b",
  title: SERIES_B_HEADLINE,
  publisher: "Baku Tech Review",
  language: "en",
  sourceType: "news",
  publishedDate: "2025-03-12",
  access: "read",
  snippet: SERIES_B_SNIPPET,
  body: lines("BAKU, 12 March 2025 —", ...SERIES_B_BODY),
  categories: ["news"],
  nameForms: ["Elnara Gasimova"],
  storyKey: "caspian-lantern-series-b",
};

const seriesBCaspianMarkets: FixtureDocument = {
  key: "series-b-caspian-markets-daily",
  url: "https://caspianmarketsdaily.example/tech/caspian-lantern-analytics-raises-18m",
  title: SERIES_B_HEADLINE,
  publisher: "Caspian Markets Daily",
  language: "en",
  sourceType: "news",
  publishedDate: "2025-03-12",
  access: "read",
  snippet: SERIES_B_SNIPPET,
  body: lines("BAKU —", ...SERIES_B_BODY, "", "This article was first published by Baku Tech Review."),
  categories: ["news"],
  nameForms: ["Elnara Gasimova"],
  storyKey: "caspian-lantern-series-b",
};

const seriesBEurasiaStartup: FixtureDocument = {
  key: "series-b-eurasia-startup-journal",
  url: "https://eurasiastartupjournal.example/funding/2025/03/13/caspian-lantern-series-b",
  title: SERIES_B_HEADLINE,
  publisher: "Eurasia Startup Journal",
  language: "en",
  sourceType: "news",
  publishedDate: "2025-03-13",
  access: "read",
  snippet: SERIES_B_SNIPPET,
  body: lines(...SERIES_B_BODY, "", "Originally published by Baku Tech Review on 12 March 2025."),
  categories: ["news"],
  nameForms: ["Elnara Gasimova"],
  storyKey: "caspian-lantern-series-b",
};

const paywalledFeature: FixtureDocument = {
  key: "caspian-ledger-data-talent",
  url: "https://caspianledger.example/features/2025/07/07/inside-the-race-for-caspian-data-talent",
  title: "Inside the race for Caspian data talent",
  publisher: "The Caspian Ledger",
  language: "en",
  sourceType: "news",
  publishedDate: "2025-07-07",
  access: "paywalled",
  snippet:
    "Employers in Baku are competing for a small pool of experienced data engineers. “We now train most of our senior hires ourselves,” says Elnara Gasimova, chief executive of Caspian Lantern Analytics…",
  body: null,
  categories: ["news"],
  nameForms: ["Elnara Gasimova"],
};

const contractorDispute: FixtureDocument = {
  key: "baku-business-chronicle-contractor-dispute",
  url: "https://bakubusinesschronicle.example/2025/09/10/contractor-alleges-unpaid-invoices-caspian-lantern",
  title: "Former contractor alleges unpaid invoices at Caspian Lantern Analytics",
  publisher: "Baku Business Chronicle",
  language: "en",
  sourceType: "news",
  publishedDate: "2025-09-10",
  access: "read",
  snippet:
    "A Baku software studio says three invoices for work it did for Caspian Lantern Analytics in 2024 remain unpaid. The company disputes the invoices and says it has offered mediation.",
  body: lines(
    "Mirvari Digital, a Baku software studio that built data-visualisation tools for Caspian Lantern Analytics in 2024, says three of its invoices for that work remain unpaid.",
    "",
    "In a statement to the Baku Business Chronicle, Mirvari Digital said the invoices, totalling 46,000 manat, were issued between May and August 2024 and that repeated reminders had gone unanswered. The studio provided copies of the invoices but not of the underlying contract.",
    "",
    "A spokesperson for Caspian Lantern Analytics, whose chief executive is Elnara Gasimova, said the company disputes the invoices because the delivered software “did not meet the specification agreed in the contract”. The spokesperson said the company had paid in full for earlier phases of the project and had offered to resolve the remaining disagreement through mediation.",
    "",
    "Neither side said it had filed a claim in court, and the Baku Business Chronicle has not found any court ruling on the matter. Mirvari Digital said it was considering its options.",
    "",
    "Caspian Lantern Analytics, founded in 2019, raised $18 million in a Series B round in March 2025.",
  ),
  categories: ["news"],
  nameForms: ["Elnara Gasimova"],
};

const azPodcast: FixtureDocument = {
  key: "reqem-sohbetleri-gasimova-podcast",
  url: "https://reqemsohbetleri.example/epizod/18-elnare-qasimova",
  title: "Rəqəm Söhbətləri, 18-ci epizod: Elnarə Qasımova ilə açıq məlumatlar və enerji proqnozları",
  publisher: "Rəqəm Söhbətləri",
  language: "az",
  sourceType: "interview",
  publishedDate: "2022-05-14",
  access: "read",
  snippet:
    "Podkastın bu epizodunda Caspian Lantern Analytics şirkətinin həmtəsisçisi Elnarə Qasımova enerji sektorunda proqnozlaşdırmadan və açıq məlumatların əhəmiyyətindən danışır.",
  body: lines(
    "Rəqəm Söhbətləri — texnologiya və məlumat dünyasından olan insanlarla həftəlik söhbətlər.",
    "",
    "18-ci epizod: Elnarə Qasımova ilə açıq məlumatlar və enerji proqnozları",
    "Yayım tarixi: 14 may 2022. Müddəti: 52 dəqiqə.",
    "",
    "Bu epizodun qonağı Caspian Lantern Analytics şirkətinin həmtəsisçisi və baş icraçı direktoru Elnarə Qasımovadır. Söhbətimizdə elektrik enerjisinə tələbatın necə proqnozlaşdırıldığından, külək və günəş enerjisinin şəbəkəyə inteqrasiyasının yaratdığı çətinliklərdən və məlumat keyfiyyətinin niyə həlledici olduğundan danışdıq.",
    "",
    "Elnarə xanım həmçinin bu il idarə heyətinə qoşulduğu Baku Data Commons Foundation təşkilatının işindən və açıq məlumat dəstlərinin tədqiqatçılar üçün əhəmiyyətindən bəhs etdi.",
    "",
    "Epizodda müzakirə olunan mövzular:",
    "— tələbat proqnozlarında ən çox rast gəlinən səhvlər;",
    "— kiçik komandalarda məlumat keyfiyyətinin yoxlanılması;",
    "— regionda məlumat mühəndislərinin hazırlanması.",
    "",
    "Epizodu saytımızda və podkast tətbiqlərində dinləyə bilərsiniz.",
  ),
  categories: ["news"],
  nameForms: ["Elnarə Qasımova"],
  versions: [2],
};

const linkedinResult: FixtureDocument = {
  key: "linkedin-gasimova-result",
  url: "https://linkedin.example/in/elnara-gasimova",
  title: "Elnara Gasimova – Co-founder & CEO – Caspian Lantern Analytics | linkedin.example",
  publisher: "linkedin.example",
  language: "en",
  sourceType: "social_profile",
  publishedDate: null,
  access: "login_required",
  snippet:
    "Elnara Gasimova. Co-founder & CEO at Caspian Lantern Analytics. Baku, Azerbaijan. Sign in to view the full profile, experience and education.",
  body: null,
  categories: ["discovery", "accounts"],
  nameForms: ["Elnara Gasimova"],
};

/* ---------------------------------- Extraction --------------------------------- */

const FOUNDED_STATEMENT = "Co-founded Caspian Lantern Analytics in 2019";

const bioFactsCommon = (): NonNullable<FixtureDocExtraction["facts"]> => [
  fact({
    category: "biography",
    statement: FOUNDED_STATEMENT,
    start: "2019",
    supporting_excerpt: "She co-founded the company in Baku in 2019 with Rauf Sadigov",
  }),
  fact({
    category: "employment",
    organisation: "Absheron Grid Partners",
    title: "Senior Analyst",
    start: "2014",
    end: "2017",
    currency: "ended",
    supporting_excerpt: "She joined the firm in 2014 as a Senior Analyst and served as Head of Research from 2017 to 2019",
  }),
  fact({
    category: "employment",
    organisation: "Absheron Grid Partners",
    title: "Head of Research",
    start: "2017",
    end: "2019",
    currency: "ended",
    supporting_excerpt: "She joined the firm in 2014 as a Senior Analyst and served as Head of Research from 2017 to 2019",
  }),
  fact({
    category: "affiliation",
    organisation: "Baku Data Commons Foundation",
    title: "Board Member",
    start: "2022",
    currency: "stated_current",
    supporting_excerpt: "Since 2022 she has served on the board of the Baku Data Commons Foundation",
  }),
  fact({
    category: "education",
    institution: "Western Caspian Institute of Technology",
    qualification: "BSc",
    field: "Applied Mathematics",
    end: "2012",
    currency: "ended",
    supporting_excerpt: BIO_EDUCATION,
  }),
  fact({
    category: "location",
    place: "Baku",
    place_scope: "based",
    currency: "stated_current",
    supporting_excerpt: "Elnara is based in Baku and regularly works from the London office.",
  }),
  fact({
    category: "publication",
    publication_title: "Grid Flexibility in the South Caucasus",
    start: "2021",
    supporting_excerpt: "She is a co-author of the 2021 report “Grid Flexibility in the South Caucasus”.",
  }),
];

const bioAccounts: NonNullable<FixtureDocExtraction["accounts"]> = [
  {
    platform: "linkedin",
    url: "https://linkedin.example/in/elnara-gasimova",
    handle: "elnara-gasimova",
    description: "Professional networking profile",
    discovery: "linked_from_official_bio",
    supporting_excerpt: "Professional profile: linkedin.example/in/elnara-gasimova",
    identity_evidence: "Linked from her biography on the Caspian Lantern Analytics website.",
  },
  {
    platform: "website",
    url: "https://elnaragasimova.example",
    handle: null,
    description: "Personal website",
    discovery: "linked_from_official_bio",
    supporting_excerpt: "Personal website: elnaragasimova.example",
    identity_evidence: "Linked from her biography on the Caspian Lantern Analytics website.",
  },
];

const coFounderRelationship = (excerpt: string) =>
  relationship({
    relation_type: "co_founder",
    counterpart_name: "Rauf Sadigov",
    counterpart_role: "Co-founder",
    organisation: "Caspian Lantern Analytics",
    start: "2019",
    supporting_excerpt: excerpt,
  });

const SERIES_B_SUMMARY =
  "Reports an $18 million Series B round for Caspian Lantern Analytics led by Silk Meridian Ventures, to be used for engineering hiring in Baku, the London office and a Central Asian launch. Gasimova is quoted on demand volatility and hiring plans.";

const seriesBMedia = (outlet: string, publishedDate: string) =>
  media({
    headline: SERIES_B_HEADLINE,
    outlet,
    kind: "article",
    published_date: publishedDate,
    language: "en",
    summary: SERIES_B_SUMMARY,
    involvement: "Quoted as co-founder and chief executive",
    coverage_type: "organisation",
    topic: "funding",
    identity_evidence: "Names Elnara Gasimova as co-founder and chief executive of Caspian Lantern Analytics.",
  });

const seriesBSource = (publishedDate: string) =>
  source({
    about_subject: "yes",
    identity_evidence: "Quotes Elnara Gasimova as co-founder and chief executive of Caspian Lantern Analytics.",
    source_type: "news",
    page_language: "en",
    published_date: publishedDate,
  });

const extraction: Record<string, FixtureDocExtraction> = {
  [officialBioV1.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Official biography on the Caspian Lantern Analytics website.",
      source_type: "official_bio",
      page_language: "en",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Caspian Lantern Analytics",
        title: "Chief Executive Officer",
        start: "2019",
        currency: "stated_current",
        supporting_excerpt:
          "Elnara Gasimova is co-founder and Chief Executive Officer of Caspian Lantern Analytics. She co-founded the company in Baku in 2019 with Rauf Sadigov and has led it as CEO since then.",
      }),
      ...bioFactsCommon(),
    ],
    accounts: bioAccounts,
    relationships: [coFounderRelationship("She co-founded the company in Baku in 2019 with Rauf Sadigov")],
  },

  [officialBioV2.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Official biography on the Caspian Lantern Analytics website.",
      source_type: "official_bio",
      page_language: "en",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Caspian Lantern Analytics",
        title: "Executive Chair",
        start: "2026-09",
        currency: "stated_current",
        supporting_excerpt:
          "Elnara Gasimova is co-founder and Executive Chair of Caspian Lantern Analytics...until September 2026, when she became Executive Chair",
      }),
      fact({
        category: "employment",
        organisation: "Caspian Lantern Analytics",
        title: "Chief Executive Officer",
        start: "2019",
        end: "2026-09",
        currency: "ended",
        supporting_excerpt: "served as Chief Executive Officer from 2019 until September 2026",
      }),
      ...bioFactsCommon(),
    ],
    accounts: bioAccounts,
    relationships: [coFounderRelationship("She co-founded the company in Baku in 2019 with Rauf Sadigov")],
  },

  [aboutPage.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Company history page naming Elnara Gasimova as a co-founder.",
      source_type: "company_site",
      page_language: "en",
    }),
    facts: [
      fact({
        category: "biography",
        statement: FOUNDED_STATEMENT,
        start: "2019",
        supporting_excerpt: "Caspian Lantern Analytics was founded in Baku in 2019 by Elnara Gasimova and Rauf Sadigov.",
      }),
    ],
    relationships: [coFounderRelationship("Caspian Lantern Analytics was founded in Baku in 2019 by Elnara Gasimova and Rauf Sadigov.")],
  },

  [contactPageV1.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Company contact page naming the executive assistant who handles requests for Elnara Gasimova.",
      source_type: "company_site",
      page_language: "en",
    }),
    contacts: [
      {
        contact_type: "switchboard",
        value: "+44 20 7946 0321",
        belongs_to: "organisation",
        owner_label: "Caspian Lantern Analytics, London office reception",
        purpose: "General enquiries",
        publication_context: "Company contact page, listed as the London office reception",
        supporting_excerpt: "London office reception: +44 20 7946 0321",
      },
      {
        contact_type: "press_office",
        value: "press@caspianlantern.example",
        belongs_to: "organisation",
        owner_label: "Caspian Lantern Analytics press office",
        purpose: "Media requests",
        publication_context: "Company contact page, media section",
        supporting_excerpt: "Press office: press@caspianlantern.example",
      },
      {
        contact_type: "assistant",
        value: "+44 20 7946 0358",
        belongs_to: "assistant",
        owner_label: "Leyla Hüseynzadə, Executive Assistant (Office of the CEO)",
        purpose: "Meeting and speaking requests for Elnara Gasimova",
        publication_context: "Company contact page, listed under the Office of the CEO",
        supporting_excerpt: "Leyla Hüseynzadə, Executive Assistant to Elnara Gasimova Telephone: +44 20 7946 0358",
      },
      {
        contact_type: "contact_page",
        value: CONTACT_URL,
        belongs_to: "organisation",
        owner_label: "Caspian Lantern Analytics",
        purpose: "General enquiry form",
        publication_context: "Company contact page",
        supporting_excerpt: `Enquiry form: ${CONTACT_URL}#enquiry-form`,
      },
    ],
  },

  [contactPageV2.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Company contact page naming the executive assistant who handles requests for Elnara Gasimova.",
      source_type: "company_site",
      page_language: "en",
    }),
    contacts: [
      {
        contact_type: "switchboard",
        value: "+44 20 7946 0321",
        belongs_to: "organisation",
        owner_label: "Caspian Lantern Analytics, London office reception",
        purpose: "General enquiries",
        publication_context: "Company contact page, listed as the London office reception",
        supporting_excerpt: "London office reception: +44 20 7946 0321",
      },
      {
        contact_type: "press_office",
        value: "press@caspianlantern.example",
        belongs_to: "organisation",
        owner_label: "Caspian Lantern Analytics press office",
        purpose: "Media requests",
        publication_context: "Company contact page, media section",
        supporting_excerpt: "Press office: press@caspianlantern.example",
      },
      {
        contact_type: "assistant",
        value: "+44 20 7946 0358",
        belongs_to: "assistant",
        owner_label: "Leyla Hüseynzadə, Executive Assistant (Office of the Executive Chair)",
        purpose: "Meeting and speaking requests for Elnara Gasimova",
        publication_context: "Company contact page, listed under the Office of the Executive Chair",
        supporting_excerpt: "Leyla Hüseynzadə, Executive Assistant to Elnara Gasimova Telephone: +44 20 7946 0358",
      },
      {
        contact_type: "contact_page",
        value: CONTACT_URL,
        belongs_to: "organisation",
        owner_label: "Caspian Lantern Analytics",
        purpose: "General enquiry form",
        publication_context: "Company contact page",
        supporting_excerpt: `Enquiry form: ${CONTACT_URL}#enquiry-form`,
      },
    ],
  },

  [personalSite.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Personal website linked from her official biography and written in the first person.",
      source_type: "personal_site",
      page_language: "en",
      updated_date: "2026-02",
      self_published: true,
    }),
    facts: [
      fact({
        category: "biography",
        statement: FOUNDED_STATEMENT,
        start: "2019",
        supporting_excerpt: "I co-founded Caspian Lantern Analytics in 2019 and I am based in Baku",
      }),
      fact({
        category: "location",
        place: "Baku",
        place_scope: "based",
        currency: "stated_current",
        supporting_excerpt: "I co-founded Caspian Lantern Analytics in 2019 and I am based in Baku",
      }),
    ],
    contacts: [
      {
        contact_type: "business_mobile",
        value: "+44 7700 900417",
        belongs_to: "person",
        owner_label: "Elnara Gasimova",
        purpose: "Speaking and professional enquiries",
        publication_context: "Published by Elnara Gasimova on her own website for speaking and professional enquiries",
        supporting_excerpt: "For speaking and professional enquiries, please call or message +44 7700 900417.",
      },
    ],
    accounts: [
      {
        platform: "x",
        url: "https://x.example/elnara_builds",
        handle: "elnara_builds",
        description: "Short posts",
        discovery: "linked_from_personal_site",
        supporting_excerpt: "Short posts: x.example/elnara_builds",
        identity_evidence: "Linked from her personal website, which her official biography links to.",
      },
      {
        platform: "linkedin",
        url: "https://linkedin.example/in/elnara-gasimova",
        handle: "elnara-gasimova",
        description: "Professional networking profile",
        discovery: "linked_from_personal_site",
        supporting_excerpt: "Professional profile: linkedin.example/in/elnara-gasimova",
        identity_evidence: "Linked from her personal website.",
      },
    ],
  },

  [summitSpeakerPage.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Speaker page naming Elnara Gasimova as co-founder and CEO of Caspian Lantern Analytics.",
      source_type: "conference",
      page_language: "en",
      published_date: "2025-04-22",
    }),
    contacts: [
      {
        contact_type: "work_email",
        value: "e.gasimova@caspianlantern.example",
        belongs_to: "person",
        owner_label: "Elnara Gasimova",
        purpose: "Programme enquiries about her summit session",
        publication_context: "Published by the Eurasia Data Leaders Summit on her speaker page, at the speaker's request",
        supporting_excerpt:
          "the speaker has asked that programme enquiries be sent to e.gasimova@caspianlantern.example",
      },
    ],
  },

  [leadershipPressRelease.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Company press release about Elnara Gasimova's change of role.",
      source_type: "press_release",
      page_language: "en",
      published_date: "@run-date",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Caspian Lantern Analytics",
        title: "Executive Chair",
        start: "2026-09",
        currency: "stated_current",
        supporting_excerpt:
          "had led it as CEO since then, has become Executive Chair...a leadership transition that began in September 2026",
      }),
      fact({
        category: "employment",
        organisation: "Caspian Lantern Analytics",
        title: "Chief Executive Officer",
        start: "2019",
        currency: "ended",
        supporting_excerpt:
          "Elnara Gasimova, who co-founded the company with him in 2019 and had led it as CEO since then, has become Executive Chair.",
      }),
    ],
    contacts: [
      {
        contact_type: "press_office",
        value: "press@caspianlantern.example",
        belongs_to: "organisation",
        owner_label: "Caspian Lantern Analytics press office",
        purpose: "Media requests",
        publication_context: "Media contact on a company press release",
        supporting_excerpt: "Media contact: press@caspianlantern.example",
      },
    ],
    relationships: [
      coFounderRelationship("Elnara Gasimova, who co-founded the company with him in 2019"),
    ],
    media: [
      media({
        headline: leadershipPressRelease.title,
        outlet: "Caspian Lantern Analytics",
        kind: "press_release",
        published_date: "@run-date",
        language: "en",
        summary:
          "Company announcement that co-founder Rauf Sadigov has been appointed chief executive and that Gasimova, CEO since 2019, has become Executive Chair, leading the board and focusing on partnerships and UK growth.",
        involvement: "Moves from chief executive to Executive Chair",
        coverage_type: "direct",
        topic: "appointment",
        identity_evidence: "Issued by her company and names her role change.",
      }),
    ],
  },

  [programmeV1.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Conference speaker profile naming her as co-founder of Caspian Lantern Analytics.",
      source_type: "conference",
      page_language: "en",
      published_date: "2019-09-16",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Absheron Grid Partners",
        title: "Senior Analyst",
        start: "2015",
        currency: "ended",
        supporting_excerpt: "She joined Absheron Grid Partners in 2015 as a senior analyst and later led its research team",
      }),
      fact({
        category: "biography",
        statement: FOUNDED_STATEMENT,
        start: "2019",
        supporting_excerpt: "Elnara Gasimova is co-founder of Caspian Lantern Analytics, a Baku start-up launched this year",
      }),
    ],
  },

  [programmeV2.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Conference speaker profile naming her as co-founder of Caspian Lantern Analytics (corrected version).",
      source_type: "conference",
      page_language: "en",
      published_date: "2019-09-16",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Absheron Grid Partners",
        title: "Senior Analyst",
        start: "2014",
        currency: "ended",
        supporting_excerpt: "She joined Absheron Grid Partners in 2014 as a senior analyst and later led its research team",
      }),
      fact({
        category: "biography",
        statement: FOUNDED_STATEMENT,
        start: "2019",
        supporting_excerpt: "Elnara Gasimova is co-founder of Caspian Lantern Analytics, a Baku start-up launched this year",
      }),
    ],
  },

  [azCareerInterview.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Interview with Elnarə Qasımova, introduced as co-founder and chief executive of Caspian Lantern Analytics.",
      source_type: "interview",
      page_language: "az",
      published_date: "2021-03-15",
    }),
    facts: [
      fact({
        category: "education",
        institution: "University of Northgate",
        qualification: "magistr",
        field: "məlumat elmi",
        end: "2013",
        currency: "ended",
        english_rendering: "MSc, Data Science",
        supporting_excerpt: "2013-cü ildə Northgate Universitetində məlumat elmi üzrə magistr dərəcəsi aldım",
      }),
      fact({
        category: "employment",
        organisation: "Absheron Grid Partners",
        title: "baş analitik",
        start: "2014",
        currency: "ended",
        english_rendering: "Senior Analyst",
        supporting_excerpt: "2014-cü ildə baş analitik kimi Absheron Grid Partners şirkətinə qoşuldum",
      }),
    ],
    media: [
      media({
        headline: azCareerInterview.title,
        outlet: "Karyera Jurnalı",
        kind: "interview",
        published_date: "2021-03-15",
        language: "az",
        summary:
          "Azerbaijani-language career interview in which Gasimova describes studying mathematics in Baku and data science in the UK, her first role at Absheron Grid Partners, and her advice to early-career analysts.",
        involvement: "Interviewee",
        coverage_type: "direct",
        topic: "interview",
        identity_evidence: "Introduces her as co-founder and chief executive of Caspian Lantern Analytics.",
      }),
    ],
  },

  [appointment2017.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Trade-press article about her appointment at Absheron Grid Partners.",
      source_type: "news",
      page_language: "en",
      published_date: "2017-09-05",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Absheron Grid Partners",
        title: "Head of Research",
        start: "2017-10",
        supporting_excerpt: "has named Elnara Gasimova head of research...She will take up the new post on 1 October",
      }),
      // An old article saying "currently": the verifier flags this as possibly outdated.
      fact({
        category: "employment",
        organisation: "Absheron Grid Partners",
        title: "Forecasting Research Lead",
        currency: "stated_current",
        supporting_excerpt: "Gasimova, who joined the consultancy as a senior analyst, currently leads its forecasting research team",
      }),
    ],
    media: [
      media({
        headline: appointment2017.title,
        outlet: "Caspian Energy Monitor",
        kind: "article",
        published_date: "2017-09-05",
        event_date: "2017-10",
        language: "en",
        summary:
          "Trade-press report that Absheron Grid Partners named Gasimova head of research from October 2017; at the time she led the consultancy's forecasting research team.",
        involvement: "Subject of the appointment",
        coverage_type: "direct",
        topic: "appointment",
        identity_evidence: "Names Elnara Gasimova of Absheron Grid Partners, her employer before Caspian Lantern Analytics.",
      }),
    ],
  },

  [londonOffice.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Quotes Elnara Gasimova as chief executive of Caspian Lantern Analytics.",
      source_type: "news",
      page_language: "en",
      published_date: "2024-01-20",
    }),
    media: [
      media({
        headline: londonOffice.title,
        outlet: "Thames Data Weekly",
        kind: "article",
        published_date: "2024-01-20",
        language: "en",
        summary:
          "Reports that Caspian Lantern Analytics opened its first office outside Azerbaijan, in London, with an initial team of eight focused on UK clients, while product and engineering stay in Baku.",
        involvement: "Quoted as chief executive",
        coverage_type: "organisation",
        topic: "business",
        identity_evidence: "Names Elnara Gasimova as chief executive of Caspian Lantern Analytics.",
      }),
    ],
  },

  [boardPage.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Board page listing Elnara Gasimova, co-founder of Caspian Lantern Analytics, as a director.",
      source_type: "company_site",
      page_language: "en",
    }),
    facts: [
      fact({
        category: "affiliation",
        organisation: "Baku Data Commons Foundation",
        title: "Board Member",
        start: "2022",
        currency: "stated_current",
        supporting_excerpt:
          "Elnara Gasimova — Director Co-founder of Caspian Lantern Analytics. Member of the board since 2022",
      }),
    ],
    relationships: [
      relationship({
        relation_type: "fellow_director",
        counterpart_name: "Aynur Karimova",
        counterpart_role: "Chair of the board",
        organisation: "Baku Data Commons Foundation",
        start: "2022",
        supporting_excerpt: "Dr. Aynur Karimova — Chair...Elnara Gasimova — Director",
      }),
      relationship({
        relation_type: "fellow_director",
        counterpart_name: "Martin Ellery",
        counterpart_role: "Director; Professor of Energy Systems, University of Northgate",
        organisation: "Baku Data Commons Foundation",
        start: "2022",
        supporting_excerpt: "Elnara Gasimova — Director...Prof. Martin Ellery — Director",
      }),
      relationship({
        relation_type: "fellow_director",
        counterpart_name: "Samir Bagirzade",
        counterpart_role: "Director and Treasurer",
        organisation: "Baku Data Commons Foundation",
        start: "2022",
        supporting_excerpt: "Elnara Gasimova — Director...Samir Bagirzade — Director and Treasurer",
      }),
    ],
  },

  [gridReport.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Report authorship lists Elnara Gasimova of Caspian Lantern Analytics.",
      source_type: "academic",
      page_language: "en",
      published_date: "2021-06",
    }),
    facts: [
      fact({
        category: "publication",
        publication_title: "Grid Flexibility in the South Caucasus",
        venue: "University of Northgate, Energy Systems Group",
        start: "2021-06",
        supporting_excerpt:
          "Authors: Prof. Martin Ellery (Energy Systems Group, University of Northgate) and Elnara Gasimova (Caspian Lantern Analytics)",
      }),
    ],
    relationships: [
      relationship({
        relation_type: "co_author",
        counterpart_name: "Martin Ellery",
        counterpart_role: "Professor, Energy Systems Group, University of Northgate",
        project: "Grid Flexibility in the South Caucasus",
        start: "2021",
        supporting_excerpt:
          "Authors: Prof. Martin Ellery (Energy Systems Group, University of Northgate) and Elnara Gasimova (Caspian Lantern Analytics)",
      }),
    ],
  },

  [alumniPage.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Former employer's alumni page; the entry names her later company, Caspian Lantern Analytics.",
      source_type: "company_site",
      page_language: "en",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Absheron Grid Partners",
        title: "Senior Analyst",
        start: "2014",
        currency: "ended",
        supporting_excerpt: "Elnara Gasimova (2014–2019) — Senior Analyst, then Head of Research.",
      }),
      fact({
        category: "employment",
        organisation: "Absheron Grid Partners",
        title: "Head of Research",
        end: "2019",
        currency: "ended",
        supporting_excerpt: "Elnara Gasimova (2014–2019) — Senior Analyst, then Head of Research.",
      }),
      fact({
        category: "biography",
        statement: FOUNDED_STATEMENT,
        start: "2019",
        supporting_excerpt: "Co-founded Caspian Lantern Analytics in 2019.",
      }),
    ],
    relationships: [
      // Overlapping employment is a shared affiliation, not a personal relationship.
      relationship({
        relation_type: "shared_employer",
        counterpart_name: "Nicat Rzayev",
        counterpart_role: "Grid Modelling Engineer",
        organisation: "Absheron Grid Partners",
        start: "2014",
        end: "2018",
        supporting_excerpt: "Nicat Rzayev (2014–2018) — Grid Modelling Engineer.",
      }),
    ],
  },

  [ruInterview.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Interview with Эльнара Гасымова, introduced as co-founder and chief executive of Caspian Lantern Analytics.",
      source_type: "interview",
      page_language: "ru",
      published_date: "2024-06-18",
    }),
    facts: [
      fact({
        category: "employment",
        organisation: "Caspian Lantern Analytics",
        title: "генеральный директор",
        english_rendering: "Chief Executive Officer",
        supporting_excerpt: "Мы поговорили с её сооснователем и генеральным директором Эльнарой Гасымовой.",
      }),
    ],
    media: [
      media({
        headline: ruInterview.title,
        outlet: "Деловой Каспий",
        kind: "interview",
        published_date: "2024-06-18",
        language: "ru",
        summary:
          "Russian-language interview in which Gasimova argues that datasets need owners, documentation and maintenance like physical infrastructure, and discusses the London office and the shortage of experienced data engineers.",
        involvement: "Interviewee (co-founder and chief executive)",
        coverage_type: "direct",
        topic: "interview",
        identity_evidence: "Introduces her as co-founder and chief executive of Caspian Lantern Analytics.",
      }),
    ],
  },

  [azForumArticle.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Report names Elnarə Qasımova as co-founder and chief executive of Caspian Lantern Analytics.",
      source_type: "news",
      page_language: "az",
      published_date: "2023-11-02",
    }),
    media: [
      media({
        headline: azForumArticle.title,
        outlet: "Rəqəmsal Gündəm",
        kind: "article",
        published_date: "2023-11-02",
        language: "az",
        summary:
          "Azerbaijani-language report from the Baku Data Forum, where Gasimova spoke on an open-data panel and argued that public bodies should publish well-documented datasets.",
        involvement: "Panel speaker",
        coverage_type: "direct",
        topic: "event",
        identity_evidence: "Names her as co-founder and chief executive of Caspian Lantern Analytics.",
      }),
    ],
  },

  [seriesBBakuTechReview.key]: {
    source: seriesBSource("2025-03-12"),
    facts: [
      fact({
        category: "employment",
        organisation: "Caspian Lantern Analytics",
        title: "Chief Executive",
        supporting_excerpt: "said Elnara Gasimova, co-founder and chief executive of Caspian Lantern Analytics",
      }),
    ],
    media: [seriesBMedia("Baku Tech Review", "2025-03-12")],
  },

  [seriesBCaspianMarkets.key]: {
    source: seriesBSource("2025-03-12"),
    media: [seriesBMedia("Caspian Markets Daily", "2025-03-12")],
  },

  [seriesBEurasiaStartup.key]: {
    source: seriesBSource("2025-03-13"),
    media: [seriesBMedia("Eurasia Startup Journal", "2025-03-13")],
  },

  [paywalledFeature.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Search snippet quotes Elnara Gasimova as chief executive of Caspian Lantern Analytics; the article is paywalled.",
      source_type: "news",
      page_language: "en",
      published_date: "2025-07-07",
    }),
    media: [
      media({
        headline: paywalledFeature.title,
        outlet: "The Caspian Ledger",
        kind: "article",
        published_date: "2025-07-07",
        language: "en",
        summary:
          "Feature on competition among Baku employers for experienced data engineers. Only the search snippet was available; in it, Gasimova says her company now trains most senior hires itself.",
        involvement: "Quoted as chief executive of Caspian Lantern Analytics",
        coverage_type: "direct",
        topic: "business",
        identity_evidence: "Snippet names her as chief executive of Caspian Lantern Analytics.",
      }),
    ],
  },

  [contractorDispute.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Names Elnara Gasimova as chief executive of Caspian Lantern Analytics, the company in the dispute.",
      source_type: "news",
      page_language: "en",
      published_date: "2025-09-10",
    }),
    media: [
      media({
        headline: contractorDispute.title,
        outlet: "Baku Business Chronicle",
        kind: "article",
        published_date: "2025-09-10",
        language: "en",
        summary:
          "Reports a payment dispute between Caspian Lantern Analytics and a former software contractor over three invoices from 2024. The company disputes the invoices and says it has offered mediation; the article reports no court claim or ruling.",
        involvement: "Not named in the allegations; mentioned only as the company's chief executive",
        coverage_type: "organisation",
        topic: "legal",
        identity_evidence: "Names Elnara Gasimova as chief executive of Caspian Lantern Analytics.",
        allegations: {
          allegations: [
            {
              text: "Three invoices totalling 46,000 manat for work done for Caspian Lantern Analytics in 2024 remain unpaid despite repeated reminders.",
              attributed_to: "Mirvari Digital (former contractor), in a statement to Baku Business Chronicle",
            },
          ],
          responses: [
            {
              text: "The company disputes the invoices because the delivered software did not meet the agreed specification, says earlier phases were paid in full, and says it has offered mediation.",
              attributed_to: "Spokesperson for Caspian Lantern Analytics",
            },
          ],
          outcomes: [],
        },
      }),
    ],
  },

  [azPodcast.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence: "Podcast page introduces Elnarə Qasımova as co-founder and chief executive of Caspian Lantern Analytics.",
      source_type: "interview",
      page_language: "az",
      published_date: "2022-05-14",
    }),
    facts: [
      fact({
        category: "affiliation",
        organisation: "Baku Data Commons Foundation",
        title: "idarə heyətinin üzvü",
        english_rendering: "Board Member",
        start: "2022",
        supporting_excerpt: "bu il idarə heyətinə qoşulduğu Baku Data Commons Foundation təşkilatının işindən",
      }),
    ],
    media: [
      media({
        headline: azPodcast.title,
        outlet: "Rəqəm Söhbətləri",
        kind: "podcast",
        published_date: "2022-05-14",
        language: "az",
        summary:
          "Azerbaijani-language podcast episode in which Gasimova discusses electricity demand forecasting, integrating wind and solar power into the grid, data quality and her work with the Baku Data Commons Foundation.",
        involvement: "Guest",
        coverage_type: "direct",
        topic: "interview",
        identity_evidence: "Introduces her as co-founder and chief executive of Caspian Lantern Analytics.",
      }),
    ],
  },

  [linkedinResult.key]: {
    source: source({
      about_subject: "yes",
      identity_evidence:
        "Search listing shows the same name with Caspian Lantern Analytics and Baku; her official biography links to this profile. The page itself requires sign-in.",
      source_type: "social_profile",
      page_language: "en",
    }),
    accounts: [
      {
        platform: "linkedin",
        url: "https://linkedin.example/in/elnara-gasimova",
        handle: "elnara-gasimova",
        description: "Professional networking profile (sign-in required)",
        discovery: "search_result",
        supporting_excerpt: "Elnara Gasimova – Co-founder & CEO – Caspian Lantern Analytics",
        identity_evidence: "Listing names Caspian Lantern Analytics and Baku.",
      },
    ],
  },

  /* ---- Shared documents seen from this person's perspective ---- */

  "instagram-gasimova-art-result": {
    source: source({
      about_subject: "unclear",
      identity_evidence:
        "Only the name matches. The snippet describes a painter and gives no link to Caspian Lantern Analytics or to data analytics.",
      source_type: "social_profile",
      page_language: "en",
    }),
    accounts: [
      {
        platform: "instagram",
        url: "https://instagram.example/elnara.gasimova.art",
        handle: "elnara.gasimova.art",
        description: "Painter's account (watercolours)",
        discovery: "search_snippet",
        supporting_excerpt: "Elnara Gasimova (@elnara.gasimova.art)",
        identity_evidence: "Same name only; not linked from any of her confirmed pages.",
      },
    ],
  },

  "ganja-book-fair-2024-panels": {
    source: source({
      about_subject: "unclear",
      identity_evidence:
        "The listing gives only the name Elnara Gasimova as a panelist, with no organisation, role or other detail that connects it to her.",
      source_type: "other",
      page_language: "en",
      published_date: "2024-04-10",
    }),
    media: [
      media({
        headline: "Ganja Book Fair 2024 — Panel programme",
        outlet: "Ganja Book Fair",
        kind: "article",
        published_date: "2024-04-10",
        event_date: "2024-05-18",
        language: "en",
        summary:
          "Event listing naming an Elnara Gasimova as a panelist on “Reading in the digital age” at the Ganja Book Fair 2024. Nothing in the listing connects the panelist to Caspian Lantern Analytics.",
        involvement: "Listed panelist (identity unresolved)",
        coverage_type: "unresolved_same_name",
        topic: "event",
        identity_evidence: "Name only.",
      }),
    ],
  },

  "caspian-forum-data-jobs-thread": {
    source: source({
      about_subject: "unclear",
      identity_evidence:
        "Anonymous forum thread with unverified user posts. One post contains instructions addressed to automated tools; they were treated as page text and ignored.",
      source_type: "other",
      page_language: "en",
      published_date: "2025-08-14",
    }),
  },
};

/* ---------------------------------- Synthesis ---------------------------------- */

const SELECT = {
  ceo: { category: "employment", contains: "Chief Executive Officer" },
  chair: { category: "employment", contains: "Executive Chair" },
  founded: { category: "biography", contains: "Co-founded Caspian Lantern Analytics" },
  seniorAnalyst: { category: "employment", contains: "Senior Analyst" },
  headOfResearch: { category: "employment", contains: "Head of Research" },
  bsc: { category: "education", contains: "Western Caspian Institute of Technology" },
  msc: { category: "education", contains: "University of Northgate" },
  board: { category: "affiliation", contains: "Baku Data Commons Foundation" },
  report: { category: "publication", contains: "Grid Flexibility" },
  baku: { category: "location", contains: "Baku" },
} satisfies Record<string, ClaimSelector>;

const MEDIA = {
  seriesB: { headlineContains: "Series B" },
  london: { headlineContains: "London office" },
  dispute: { headlineContains: "unpaid invoices" },
  ruInterview: { headlineContains: "это инфраструктура" },
  azForum: { headlineContains: "Bakı Məlumat Forumu" },
  pressRelease: { headlineContains: "becomes Executive Chair" },
  podcast: { headlineContains: "Rəqəm Söhbətləri" },
} satisfies Record<string, MediaSelector>;

type SummarySentence = FixtureSynthesis["summary"][number];

const educationSentence: SummarySentence = {
  text: "She holds a BSc in Applied Mathematics from the Western Caspian Institute of Technology (2012) and an MSc in Data Science from the University of Northgate (2013).",
  claims: [SELECT.bsc, SELECT.msc],
  media: [],
  kind: "sourced",
};

const boardSentence: SummarySentence = {
  text: "Since 2022 she has served on the board of the Baku Data Commons Foundation, and in 2021 she co-authored the report “Grid Flexibility in the South Caucasus” with Prof. Martin Ellery of the University of Northgate.",
  claims: [SELECT.board, SELECT.report],
  media: [],
  kind: "sourced",
};

const inferredFocus: SummarySentence = {
  text: "Taken together, her report, board role and interviews point to a sustained professional focus on data quality and open data for energy and infrastructure planning.",
  claims: [SELECT.report, SELECT.board],
  media: [MEDIA.ruInterview],
  kind: "inferred",
};

const sharedDevelopments: FixtureSynthesis["keyDevelopments"] = [
  {
    text: "A former software contractor alleged that three 2024 invoices from Caspian Lantern Analytics remain unpaid; the company disputes the invoices and says it has offered mediation. No court ruling is documented.",
    claims: [],
    media: [MEDIA.dispute],
    date: "2025-09-10",
  },
  {
    text: "Caspian Lantern Analytics raised $18 million in a Series B round led by Silk Meridian Ventures, reported by three outlets carrying the same story.",
    claims: [],
    media: [MEDIA.seriesB],
    date: "2025-03-12",
  },
  {
    text: "Caspian Lantern Analytics opened its first office outside Azerbaijan, in London.",
    claims: [],
    media: [MEDIA.london],
    date: "2024-01-20",
  },
  {
    text: "Joined the board of the Baku Data Commons Foundation.",
    claims: [SELECT.board],
    media: [],
    date: "2022",
  },
];

const sharedQuestions: FixtureSynthesis["questions"] = [
  {
    question: "How is Caspian Lantern Analytics using the Series B funding, particularly for engineering hiring and the planned launch in Central Asia?",
    claims: [],
    media: [MEDIA.seriesB],
  },
  {
    question: "Which conclusions of the 2021 report “Grid Flexibility in the South Caucasus” have held up as more wind and solar generation has come online?",
    claims: [SELECT.report],
    media: [],
  },
  {
    question: "What are the Baku Data Commons Foundation's current priorities, and how does her board role connect to Caspian Lantern's own work on data quality?",
    claims: [SELECT.board],
    media: [],
  },
  {
    question: "How has her research leadership at Absheron Grid Partners shaped the forecasting products Caspian Lantern builds today?",
    claims: [SELECT.headOfResearch],
    media: [],
  },
];

const synthesisV1: FixtureSynthesis = {
  summary: [
    {
      text: "Elnara Gasimova is co-founder and Chief Executive Officer of Caspian Lantern Analytics, a data-analytics company she co-founded in Baku in 2019 and which also has an office in London.",
      claims: [SELECT.ceo, SELECT.founded],
      media: [],
      kind: "sourced",
    },
    {
      text: "Before founding the company she worked at Absheron Grid Partners, first as a Senior Analyst and from 2017 to 2019 as Head of Research; sources give different years (2014 and 2015) for when she joined.",
      claims: [SELECT.seniorAnalyst, SELECT.headOfResearch],
      media: [],
      kind: "sourced",
    },
    educationSentence,
    boardSentence,
    {
      text: "Coverage includes her company's $18 million Series B round in March 2025, a Russian-language interview on treating data as infrastructure, and an Azerbaijani-language report on her open-data remarks at the Baku Data Forum.",
      claims: [],
      media: [MEDIA.seriesB, MEDIA.ruInterview, MEDIA.azForum],
      kind: "sourced",
    },
    inferredFocus,
  ],
  keyDevelopments: sharedDevelopments,
  gaps: [
    "Her professional networking profile could not be read because it requires sign-in; only the search listing was used.",
    "The feature “Inside the race for Caspian data talent” is paywalled, so only its search snippet was reviewed.",
    "No source explains why a 2019 conference profile gives 2015, rather than 2014, as the year she joined Absheron Grid Partners.",
    "An event listing and a social media account under the same name could not be connected to her and were left unresolved.",
  ],
  questions: sharedQuestions,
};

const synthesisV2: FixtureSynthesis = {
  summary: [
    {
      text: "Elnara Gasimova is co-founder and Executive Chair of Caspian Lantern Analytics, a data-analytics company she co-founded in Baku in 2019 and which also has an office in London.",
      claims: [SELECT.chair, SELECT.founded],
      media: [MEDIA.pressRelease],
      kind: "sourced",
    },
    {
      text: "She led the company as Chief Executive Officer from 2019 until September 2026, when co-founder Rauf Sadigov succeeded her as chief executive.",
      claims: [SELECT.ceo],
      media: [MEDIA.pressRelease],
      kind: "sourced",
    },
    {
      text: "Before founding the company she worked at Absheron Grid Partners from 2014, first as a Senior Analyst and from 2017 to 2019 as Head of Research.",
      claims: [SELECT.seniorAnalyst, SELECT.headOfResearch],
      media: [],
      kind: "sourced",
    },
    educationSentence,
    boardSentence,
    {
      text: "Coverage includes her company's $18 million Series B round in March 2025, a Russian-language interview on treating data as infrastructure, and a 2022 Azerbaijani-language podcast episode on open data and energy forecasting.",
      claims: [],
      media: [MEDIA.seriesB, MEDIA.ruInterview, MEDIA.podcast],
      kind: "sourced",
    },
    inferredFocus,
  ],
  keyDevelopments: [
    {
      text: "Became Executive Chair of Caspian Lantern Analytics as co-founder Rauf Sadigov was appointed Chief Executive Officer.",
      claims: [SELECT.chair],
      media: [MEDIA.pressRelease],
      date: "2026-09",
    },
    ...sharedDevelopments,
  ],
  gaps: [
    "Her professional networking profile could not be read because it requires sign-in; only the search listing was used.",
    "The feature “Inside the race for Caspian data talent” is paywalled, so only its search snippet was reviewed.",
    "No source yet describes how board and executive responsibilities are divided in practice after the September 2026 leadership change.",
    "A social media account under the same name could not be connected to her and was left unresolved.",
  ],
  questions: [
    {
      question: "How will responsibilities be divided between her role as Executive Chair and Rauf Sadigov's role as Chief Executive?",
      claims: [SELECT.chair],
      media: [MEDIA.pressRelease],
    },
    ...sharedQuestions,
  ],
};

/* ------------------------------------ Bundle ----------------------------------- */

export const elnaraGasimova: FixturePersonBundle = {
  person: {
    key: "elnara-gasimova",
    displayName: "Elnara Gasimova",
    nativeName: "Elnarə Qasımova",
    nameVariants: ["Elnara Gasimova", "Elnarə Qasımova", "Эльнара Гасымова"],
    organisation: "Caspian Lantern Analytics",
    role: "Co-founder and Chief Executive Officer",
    location: "Baku, Azerbaijan",
    summary:
      "Co-founder and chief executive of Caspian Lantern Analytics, a data-analytics company headquartered in Baku with an office in London.",
    distinguishingFacts: [
      "Co-founded Caspian Lantern Analytics in Baku in 2019",
      "Previously Head of Research at Absheron Grid Partners",
      "Board member of the Baku Data Commons Foundation since 2022",
      "BSc in Applied Mathematics, Western Caspian Institute of Technology",
    ],
    anchorDocKey: officialBioV1.key,
    scenarios: ["rich", "transliteration", "conflicting-dates", "duplicated-news", "blocked-source", "hostile-source"],
  },
  // Order matters: search results are returned in this order (see the note at the top).
  documents: [
    officialBioV1,
    officialBioV2,
    aboutPage,
    contactPageV1,
    contactPageV2,
    personalSite,
    summitSpeakerPage,
    leadershipPressRelease,
    programmeV1,
    programmeV2,
    azCareerInterview,
    appointment2017,
    londonOffice,
    boardPage,
    gridReport,
    alumniPage,
    ruInterview,
    azForumArticle,
    seriesBBakuTechReview,
    seriesBCaspianMarkets,
    seriesBEurasiaStartup,
    paywalledFeature,
    contractorDispute,
    azPodcast,
    linkedinResult,
  ],
  extraction,
  synthesis: { 1: synthesisV1, 2: synthesisV2 },
};
