import type { FixtureExample } from "@/fixtures/types";

/** Example searches shown on the demo search screen. Every name here is fictional. */
export const FIXTURE_EXAMPLES: FixtureExample[] = [
  {
    label: "Rich profile",
    fullName: "Elnara Gasimova",
    company: "Caspian Lantern Analytics",
    scenario:
      "Two people share this name, but only one is linked to the company you entered, so she is selected automatically and a full profile is built.",
  },
  {
    label: "Name in Cyrillic",
    fullName: "Эльнара Гасымова",
    scenario: "A Cyrillic search finds two different people with this name, so you choose which one to research.",
  },
  {
    label: "Ambiguous name",
    fullName: "Tural Mammadov",
    scenario: "Three different professionals share this name; compare their cards and pick the right one.",
  },
  {
    label: "Sparse record",
    fullName: "Sevinj Abbasli",
    scenario: "Only one public source exists, so the profile is short and states clearly what was not found.",
  },
  {
    label: "Provider failure",
    fullName: "Javid Nuriyev",
    scenario: "News searches time out on the first run, giving a partial profile that a retry completes.",
  },
  {
    label: "Profile URL match",
    fullName: "Elnara Gasimova",
    profileUrl: "https://caspianlantern.example/team/elnara-gasimova",
    scenario: "A known profile page identifies the person directly, so no identity choice is needed.",
  },
];
