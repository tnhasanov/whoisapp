import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import type { ContactOwner, ContactType, SourceType } from "@/lib/domain/types";
import { canonicaliseUrl } from "@/lib/urls/canonical";
import { digitsOnly, normaliseForMatch } from "@/lib/research/text";

export type NormalisedContact = {
  display: string;
  normalised: string | null;
  /** Formatting only. A well-formed number is NOT evidence that it is current or answered. */
  formatValid: boolean | null;
};

export function normalisePhone(value: string, defaultCountry: "AZ" | "GB" | "RU" | "US" = "AZ"): NormalisedContact {
  const trimmed = value.trim();
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed) return { display: trimmed, normalised: digitsOnly(trimmed) || null, formatValid: null };
  return {
    display: parsed.formatInternational(),
    normalised: parsed.number,
    formatValid: parsed.isPossible(),
  };
}

export function normaliseEmail(value: string): NormalisedContact {
  const trimmed = value.trim().replace(/^mailto:/i, "");
  return { display: trimmed, normalised: trimmed.toLowerCase(), formatValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) };
}

export function normaliseContactValue(type: ContactType, value: string): NormalisedContact {
  if (type === "work_email" || (type === "press_office" && value.includes("@"))) return normaliseEmail(value);
  if (type === "contact_page") return { display: value.trim(), normalised: canonicaliseUrl(value), formatValid: /^https?:\/\//i.test(value.trim()) };
  if (value.includes("@")) return normaliseEmail(value);
  return normalisePhone(value);
}

const ORGANISATION_PUBLISHED: ReadonlySet<SourceType> = new Set(["official_bio", "company_site", "registry", "conference", "press_release"]);
const SELF_PUBLISHED_TYPES: ReadonlySet<SourceType> = new Set(["personal_site", "social_profile"]);

const RECEPTION_WORDS = [
  "reception",
  "switchboard",
  "main line",
  "general enquiries",
  "general inquiries",
  "head office",
  "front desk",
  "qəbul",
  "qebul",
  "katiblik",
  "приемная",
  "приёмная",
  "ресепшн",
  "общий телефон",
  "канцелярия",
];

export type ContactDecision =
  | {
      accepted: true;
      type: ContactType;
      belongsTo: ContactOwner;
      isDirect: boolean;
      note: string | null;
    }
  | { accepted: false; reason: ContactRejection };

export type ContactRejection =
  | "value_not_in_source"
  | "personal_mobile_not_self_published"
  | "unsupported_source"
  | "invalid_value";

/**
 * Deterministic rules applied after model extraction:
 * 1. The value must literally appear in the retrieved source (no guessed emails).
 * 2. Anything published as a reception/switchboard/main line belongs to the organisation.
 * 3. A mobile number attributed to the person is accepted only when the person
 *    published it themselves (own website/profile) for professional contact.
 * 4. Only routes that reach the person are marked direct.
 */
const GENERIC_MAILBOXES = new Set([
  "info", "office", "reception", "contact", "contacts", "hello", "enquiries", "enquiry", "inquiries", "inquiry",
  "admin", "mail", "general", "secretary", "secretariat", "press", "media", "pr", "news", "support", "team", "hr", "jobs", "careers",
]);

function isGenericMailbox(value: string): boolean {
  const local = value.trim().toLowerCase().split("@")[0] ?? "";
  return GENERIC_MAILBOXES.has(local.replace(/[._-]?\d+$/, ""));
}

export function classifyContact(input: {
  type: ContactType;
  belongsTo: ContactOwner;
  value: string;
  publicationContext: string;
  supportingExcerpt: string;
  sourceType: SourceType;
  selfPublished: boolean;
  valuePresentInSource: boolean;
}): ContactDecision {
  if (!input.valuePresentInSource) return { accepted: false, reason: "value_not_in_source" };
  if (!input.value.trim()) return { accepted: false, reason: "invalid_value" };
  if (input.sourceType === "search_listing") return { accepted: false, reason: "unsupported_source" };

  const context = normaliseForMatch(`${input.publicationContext} ${input.supportingExcerpt}`);
  const looksLikeReception = RECEPTION_WORDS.some((w) => context.includes(normaliseForMatch(w)));

  let type = input.type;
  let belongsTo = input.belongsTo;
  let note: string | null = null;

  if (type === "switchboard" || type === "press_office" || type === "contact_page") {
    belongsTo = "organisation";
  }
  if (looksLikeReception && (type === "office_line" || type === "business_mobile" || type === "switchboard")) {
    if (belongsTo === "person") note = "Published as a reception/main line, so it is shown as an organisation number.";
    type = "switchboard";
    belongsTo = "organisation";
  }
  // A shared inbox (reception@, info@ …) is the organisation's, whoever reads it.
  if (type === "work_email" && belongsTo === "person" && (looksLikeReception || isGenericMailbox(input.value))) {
    note = "Published as a general or reception inbox, so it is shown as an organisation address.";
    belongsTo = "organisation";
  }
  if (belongsTo === "organisation" && (type === "office_line" || type === "business_mobile")) {
    type = "switchboard";
  }
  if (belongsTo === "organisation" && type === "work_email") {
    type = "press_office";
  }
  if (type === "business_mobile" && belongsTo === "person") {
    const selfPublished = input.selfPublished || SELF_PUBLISHED_TYPES.has(input.sourceType);
    if (!selfPublished) return { accepted: false, reason: "personal_mobile_not_self_published" };
  }
  if (type === "assistant") belongsTo = "assistant";

  const organisationPublished = ORGANISATION_PUBLISHED.has(input.sourceType);
  const isDirect = belongsTo === "person" && (type === "work_email" || type === "business_mobile" || type === "office_line");
  if (isDirect && !organisationPublished && !input.selfPublished && !SELF_PUBLISHED_TYPES.has(input.sourceType)) {
    note = note ?? "Published by a third party; confirm before relying on it.";
  }
  return { accepted: true, type, belongsTo, isDirect, note };
}

export function contactKey(type: ContactType, normalisedValue: string | null, value: string): string {
  return `${type}:${(normalisedValue ?? value).toLowerCase()}`;
}
