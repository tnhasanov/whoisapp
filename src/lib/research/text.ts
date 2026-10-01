/**
 * Text normalisation used for matching, never for display.
 *
 * Handles Azerbaijani/Turkish dotted and dotless I, typographic quotes and
 * dashes, zero-width characters and whitespace so that a verbatim excerpt can
 * be located in retrieved page text regardless of encoding noise.
 */

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

/** True when the phone number (by digits) or the literal value appears in the text. */
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
    return runDigits === digits || runDigits.endsWith(digits) || digits.endsWith(runDigits);
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
