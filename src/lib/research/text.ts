/**
 * Text normalisation used for matching, never for display.
 *
 * Handles Azerbaijani/Turkish dotted and dotless I, typographic quotes and
 * dashes, zero-width characters and whitespace so that a verbatim excerpt can
 * be located in retrieved page text regardless of encoding noise.
 */

import { parsePhoneNumberFromString, type PhoneNumber } from "libphonenumber-js/min";

const QUOTES = /[‘’‚‛ʼʹ`´]/g;
const DOUBLE_QUOTES = /[“”„‟«»‹›]/g;
const DASHES = /[‐‑‒–—―−]/g;
const ZERO_WIDTH = /[​-‍⁠﻿­]/g;
const ELLIPSIS = /…/g;

export function normaliseForMatch(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(ZERO_WIDTH, "")
    .replace(QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, "-")
    .replace(ELLIPSIS, "...")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when `excerpt` occurs in `text`. An excerpt may elide text with "..."
 * (or "…"); each fragment must then appear in order. Fragments shorter than
 * 12 characters are rejected to stop trivial matches.
 */
export function excerptAppearsIn(excerpt: string, text: string): boolean {
  const haystack = normaliseForMatch(text);
  const fragments = normaliseForMatch(excerpt)
    .split("...")
    .map((f) => f.trim().replace(/^["']|["']$/g, "").trim())
    .filter((f) => f.length > 0);
  if (fragments.length === 0) return false;
  let cursor = 0;
  for (const fragment of fragments) {
    if (fragment.length < 12 && fragments.length > 1) return false;
    if (fragment.length < 6) return false;
    const index = haystack.indexOf(fragment, cursor);
    if (index === -1) return false;
    cursor = index + fragment.length;
  }
  return true;
}

/** Digits only, for comparing phone numbers across formatting styles. */
export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}

function parsePhone(value: string, region?: PhoneNumber["country"]): PhoneNumber | undefined {
  try {
    return parsePhoneNumberFromString(value, region ? { defaultCountry: region } : undefined);
  } catch {
    return undefined;
  }
}

/** Same number written in national and international form ("(012) 555 01 23" vs "+994 12 555 01 23"). */
function samePhoneNumber(a: string, b: string): boolean {
  const pa = parsePhone(a);
  const pb = parsePhone(b);
  if (pa && pb) return pa.number === pb.number;
  const international = pa ?? pb;
  const other = pa ? b : a;
  if (!international) return false;
  if (international.country) {
    const parsed = parsePhone(other, international.country);
    if (parsed) return parsed.number === international.number;
  }
  // No region known for the calling code: accept only the usual trunk-prefix forms.
  const nsn = international.nationalNumber;
  const otherDigits = digitsOnly(other);
  const trunk = international.countryCallingCode === "7" ? ["0", "8"] : ["0"];
  return otherDigits === nsn || trunk.some((p) => otherDigits === `${p}${nsn}`) || otherDigits === `00${international.countryCallingCode}${nsn}`;
}

/**
 * True when the phone number or the literal value appears in the text. A
 * number must appear in full: in the same digits, in national/international
 * form, or as the stored value printed inside a longer number. A shorter
 * fragment on the page never confirms a longer value, so digits the model
 * added are never accepted.
 */
export function contactValueAppearsIn(value: string, text: string): boolean {
  const trimmed = value.trim();
  if (trimmed.includes("@") || /^https?:\/\//i.test(trimmed)) {
    return normaliseForMatch(text).includes(normaliseForMatch(trimmed));
  }
  const digits = digitsOnly(trimmed);
  if (digits.length < 6) return false;
  const textDigitsRuns = text.match(/[+()\d][\d\s().\-–]{5,}\d/g) ?? [];
  return textDigitsRuns.some((run) => {
    const runDigits = digitsOnly(run);
    if (runDigits === digits) return true;
    if (digits.length >= 7 && runDigits.endsWith(digits)) return true;
    return samePhoneNumber(trimmed, run.trim());
  });
}

/** Cut text to a maximum length on a word boundary, marking the cut. */
export function clip(input: string, max: number): string {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Slug-like key for stable comparisons (claim keys, organisation keys). */
export function keyify(input: string): string {
  return normaliseForMatch(input)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
