import { normaliseForMatch } from "@/lib/research/text";

/**
 * Personal-name handling for Azerbaijani, English and Russian sources.
 *
 * Variants generated here are SEARCH AIDS ONLY. A variant match never proves
 * identity; identity requires independent anchors (organisation, role,
 * official links) evaluated elsewhere.
 */

export type Script = "latin" | "cyrillic" | "mixed" | "other";

export type NameVariant = {
  text: string;
  script: "latin" | "cyrillic";
  language: "az" | "en" | "ru";
  kind: "original" | "transliteration";
};

export type NormalisedName = {
  original: string;
  /** NFC, trimmed, single-spaced. Original letters and diacritics preserved. */
  display: string;
  script: Script;
  tokens: string[];
};

const CYRILLIC = /\p{Script=Cyrillic}/u;
const LATIN = /\p{Script=Latin}/u;
const AZ_SPECIFIC = /[əƏıİğĞşŞçÇöÖüÜ]/;
const AZ_SURNAME_SUFFIX = /(ov|ova|yev|yeva|ev|eva|li|lı|lu|lü|zade|zadə|bəyli|beyli)$/i;

/**
 * True for Azerbaijani Latin spellings, including ones without special
 * letters ("Cavid Quliyev", "Tural Xəlilov" typed as "Tural Xalilov").
 */
export function looksAzerbaijaniLatin(input: string): boolean {
  if (AZ_SPECIFIC.test(input)) return true;
  const words = input.trim().split(/\s+/);
  const surname = words[words.length - 1] ?? "";
  if (!AZ_SURNAME_SUFFIX.test(surname)) return false;
  return words.some((w) => /^[CcQqXx](?!h)[a-zəıöü]/.test(w) || /[a-z](q|x)[a-z]/i.test(w) || /[a-z]c[aeiouəı]/i.test(w));
}

const RU_SURNAME_SUFFIX = /(ov|ova|ev|eva|in|ina|yn|yna|sky|skiy|skaya|enko|ich|vich)$/i;
const REGIONAL_GIVEN_NAME = /^(mammad|mamed|huseyn|guseyn|hasan|gasan|haji|hadji|javid|ali|rashid|elnar|elchin|ilham|ilgar|vugar|tural|rauf|farid|kamran|samir|nijat|nicat|orkhan|rashad|anar|aynur|leyla|lala|gunel|sevinj|sevinc|aysel|nigar|narmin|konul|ulviyya|zaur|emin|elmir|ramil|rustam|ruslan|timur|dmitr|sergey|alexey|vladimir|nikolay|olga|irina|natalya|svetlana|yelena|elena|tatyana)/i;

/**
 * True when Azerbaijani/Russian renderings are worth searching for a Latin
 * name: a regional surname shape or given name. "John Smith" gets none, so
 * the search budget is not spent on meaningless spellings.
 */
export function looksRegionalLatin(input: string): boolean {
  if (looksAzerbaijaniLatin(input)) return true;
  const words = input.trim().split(/\s+/);
  const surname = words[words.length - 1] ?? "";
  return AZ_SURNAME_SUFFIX.test(surname) || RU_SURNAME_SUFFIX.test(surname) || words.some((w) => REGIONAL_GIVEN_NAME.test(w));
}

/** Russian renderings of very common Azerbaijani name parts that do not follow letter rules. */
const RU_NAME_PARTS: [RegExp, string][] = [
  [/^məmməd/, "мамед"], [/^mammad/, "мамед"], [/^hüseyn/, "гусейн"], [/^huseyn/, "гусейн"],
  [/^həsən/, "гасан"], [/^hasan/, "гасан"], [/^hacı/, "гаджи"], [/^haji/, "гаджи"],
  [/^cavid/, "джавид"], [/^javid/, "джавид"], [/^əli/, "али"], [/^rəşid/, "рашид"],
];

function applyRuNameParts(word: string): string {
  for (const [re, rep] of RU_NAME_PARTS) {
    if (re.test(word)) return word.replace(re, rep);
  }
  return word;
}

export function detectScript(input: string): Script {
  const hasCyr = CYRILLIC.test(input);
  const hasLat = LATIN.test(input);
  if (hasCyr && hasLat) return "mixed";
  if (hasCyr) return "cyrillic";
  if (hasLat) return "latin";
  return "other";
}

export function normaliseName(input: string): NormalisedName {
  const display = input
    .normalize("NFC")
    .replace(/[​-‍⁠﻿]/g, "")
    .replace(/[“”«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    original: input,
    display,
    script: detectScript(display),
    tokens: display.split(" ").filter(Boolean),
  };
}

/* ----------------------------- Transliteration ---------------------------- */

const RU_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ə: "a", ғ: "gh", ҹ: "j", һ: "h", ө: "o", ү: "u", ҝ: "g", ј: "y",
};

function matchCase(source: string, replacement: string): string {
  if (!replacement) return replacement;
  if (source === source.toUpperCase() && source !== source.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Practical Russian→Latin transliteration (close to common passport/press usage). */
export function cyrillicToLatin(input: string): string {
  let out = "";
  const chars = [...input];
  chars.forEach((ch, i) => {
    const lower = ch.toLowerCase();
    const prev = i > 0 ? chars[i - 1].toLowerCase() : " ";
    let mapped = RU_TO_LATIN[lower];
    if (mapped === undefined) {
      out += ch;
      return;
    }
    // Word-initial / post-vowel "е" is commonly written "ye" in Azerbaijani-origin surnames (Алиева → Aliyeva).
    if (lower === "е" && (/[аеёиоуыэюяъь\s-]/.test(prev) || i === 0)) mapped = i === 0 || /[\s-]/.test(prev) ? "e" : "ye";
    out += matchCase(ch, mapped);
  });
  return out;
}

const AZ_TO_ENGLISH: Record<string, string> = {
  ə: "a", Ə: "A", ı: "i", I: "I", İ: "I", ş: "sh", Ş: "Sh", ç: "ch", Ç: "Ch", ğ: "gh", Ğ: "Gh",
  ö: "o", Ö: "O", ü: "u", Ü: "U", x: "kh", X: "Kh", q: "g", Q: "G", c: "j", C: "J", j: "zh", J: "Zh",
};

/** Azerbaijani Latin → common English press spelling (Qasımova → Gasimova, Cavid → Javid). */
export function azToEnglish(input: string): string {
  return [...input].map((ch) => AZ_TO_ENGLISH[ch] ?? ch).join("");
}

/** Strip Azerbaijani diacritics only (Qasımova → Qasimova), another common spelling. */
export function azToAsciiPreservingLetters(input: string): string {
  const map: Record<string, string> = {
    ə: "e", Ə: "E", ı: "i", İ: "I", ş: "s", Ş: "S", ç: "c", Ç: "C", ğ: "g", Ğ: "G", ö: "o", Ö: "O", ü: "u", Ü: "U",
  };
  return [...input].map((ch) => map[ch] ?? ch).join("");
}

const AZ_TO_CYR: [RegExp, string][] = [
  [/ya/g, "я"], [/yu/g, "ю"], [/yo/g, "ё"],
  [/a/g, "а"], [/b/g, "б"], [/c/g, "дж"], [/ç/g, "ч"], [/d/g, "д"], [/e/g, "е"], [/ə/g, "а"],
  [/f/g, "ф"], [/g/g, "г"], [/ğ/g, "г"], [/h/g, "г"], [/x/g, "х"], [/ı/g, "ы"], [/i/g, "и"],
  [/j/g, "ж"], [/k/g, "к"], [/q/g, "г"], [/l/g, "л"], [/m/g, "м"], [/n/g, "н"], [/o/g, "о"],
  [/ö/g, "ё"], [/p/g, "п"], [/r/g, "р"], [/s/g, "с"], [/ş/g, "ш"], [/t/g, "т"], [/u/g, "у"],
  [/ü/g, "ю"], [/v/g, "в"], [/y/g, "й"], [/z/g, "з"],
];

/** Azerbaijani Latin → conventional Russian rendering (Qasımova → Гасымова, Elnarə → Эльнара). */
export function azToCyrillic(input: string): string {
  return input
    .split(/(\s+|-)/)
    .map((word) => {
      if (!word.trim() || word === "-") return word;
      // Azerbaijani casing (I → ı) only for words that are written in Azerbaijani letters.
      let w = applyRuNameParts(AZ_SPECIFIC.test(word) ? word.toLocaleLowerCase("az") : word.toLowerCase());
      // "l" before a consonant is soft in Russian renderings (Elnara → Эльнара).
      w = w.replace(/l(?=[bcçdfgğhjkqlmnprsştvxz])/g, "lь");
      w = w.replace(/^e/, "э").replace(/^ə/, "э");
      // Surname suffixes: -iyev/-yev → -иев/-ев.
      w = w.replace(/iyev(a?)$/, "иев$1").replace(/yev(a?)$/, "ев$1");
      for (const [re, rep] of AZ_TO_CYR) w = w.replace(re, rep);
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
}

/** English press spelling → Russian rendering (Gasimova → Гасимова; heuristic). */
export function latinToCyrillic(input: string): string {
  const pairs: [RegExp, string][] = [
    [/shch/g, "щ"], [/kh/g, "х"], [/zh/g, "ж"], [/ch/g, "ч"], [/sh/g, "ш"], [/ts/g, "ц"],
    [/ya/g, "я"], [/yu/g, "ю"], [/yo/g, "ё"], [/ye/g, "е"], [/(?<=[aeiou])y(?![aeiou])/g, "й"],
    [/a/g, "а"], [/b/g, "б"], [/v/g, "в"], [/w/g, "в"], [/g/g, "г"], [/d/g, "д"], [/e/g, "е"], [/z/g, "з"],
    [/i/g, "и"], [/y/g, "ы"], [/j/g, "дж"], [/k/g, "к"], [/q/g, "к"], [/c/g, "к"], [/l/g, "л"], [/m/g, "м"],
    [/n/g, "н"], [/o/g, "о"], [/p/g, "п"], [/r/g, "р"], [/s/g, "с"], [/t/g, "т"], [/u/g, "у"], [/f/g, "ф"],
    [/h/g, "х"], [/x/g, "кс"],
  ];
  return input
    .split(/(\s+|-)/)
    .map((word) => {
      if (!word.trim() || word === "-") return word;
      let w = applyRuNameParts(word.toLowerCase());
      w = w.replace(/^e/, "э");
      w = w.replace(/l(?=[bcdfghjklmnpqrstvwxz])/g, "lь");
      w = w.replace(/iyev(a?)$/, "иев$1").replace(/yev(a?)$/, "ев$1");
      w = w.replace(/iy/g, "ий");
      for (const [re, rep] of pairs) w = w.replace(re, rep);
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
}

/**
 * English press spelling → plausible Azerbaijani spellings. Ambiguous by
 * nature, so the output is small and only used to widen searches.
 */
export function englishToAzCandidates(input: string): string[] {
  const base = input
    .replace(/kh/g, "x")
    .replace(/Kh/g, "X")
    .replace(/sh/g, "ş")
    .replace(/Sh/g, "Ş")
    .replace(/ch/g, "ç")
    .replace(/Ch/g, "Ç")
    .replace(/gh/g, "ğ")
    .replace(/zh/g, "j")
    .replace(/Zh/g, "J")
    .replace(/(^|\s)J/g, "$1C")
    .replace(/j/g, "c");
  const words = base.split(" ");
  const out: string[] = [];
  if (words.length >= 2) {
    const first = words[0];
    let last = words[words.length - 1];
    const middle = words.slice(1, -1);
    // Common surname shapes: Mammadov ↔ Məmmədov, Aliyev ↔ Əliyev.
    last = last.replace(/^Mammad/, "Məmməd").replace(/^Ali(yev|yeva)$/, "Əli$1");
    // Initial G in surnames is often Azerbaijani Q (Gasimova → Qasımova, Guliyev → Quliyev).
    const qLast = /^G[aeiouə]/.test(last) ? `Q${last.slice(1).replace(/i(?=[mnr])/, "ı")}` : last;
    // A feminine first name ending in "a" is often written with "ə" (Elnara → Elnarə).
    const azFirst = /[^i]a$/.test(first) && first.length > 3 ? `${first.slice(0, -1)}ə` : first;
    out.push([azFirst, ...middle, qLast].join(" "));
    out.push([first, ...middle, qLast].join(" "));
    out.push([first, ...middle, last].join(" "));
  }
  out.push(base);
  return [...new Set(out)].filter((v) => v !== input);
}

/** Russian rendering → plausible Azerbaijani Latin (Гасымова → Qasımova). Heuristic. */
const AZ_FROM_RU_NAME_PARTS: [RegExp, string][] = [
  [/^Mamed/, "Məmməd"], [/^Guseyn/, "Hüseyn"], [/^Gasan/, "Həsən"], [/^Gadzhi/, "Hacı"], [/^Aliyev/, "Əliyev"], [/^Aliev/, "Əliyev"],
];

export function cyrillicToAzCandidates(input: string): string[] {
  const latin = cyrillicToLatin(input);
  const az = latin
    .split(" ")
    .map((w) => AZ_FROM_RU_NAME_PARTS.reduce((acc, [re, rep]) => acc.replace(re, rep), w))
    .join(" ")
    .replace(/Dzh/g, "C")
    .replace(/dzh/g, "c")
    .replace(/kh/g, "x")
    .replace(/Kh/g, "X")
    .replace(/sh/g, "ş")
    .replace(/Sh/g, "Ş")
    .replace(/ch/g, "ç")
    .replace(/Ch/g, "Ç")
    .replace(/zh/g, "j")
    .replace(/Zh/g, "J")
    .replace(/(?<=[^aeiou])y(?=[^aeiou]|$)/g, "ı");
  const words = az.split(" ");
  const out = new Set<string>();
  if (words.length >= 2) {
    const last = words[words.length - 1];
    if (/^G/.test(last)) out.add([...words.slice(0, -1), `Q${last.slice(1)}`].join(" "));
  }
  out.add(az);
  return [...out].filter((v) => v !== input && v !== latin);
}

/* ------------------------------ Patronymics ------------------------------- */

const AZ_PATRONYMIC_MARKERS = new Set(["qızı", "qizi", "oğlu", "oglu", "кызы", "оглы", "гызы"]);
const RU_PATRONYMIC = /(ович|евич|овна|евна|ична|инична|ьевич|ьевна)$/i;

/** Remove patronymic tokens ("Rauf qızı", "Рауфовна") which vary across sources. */
export function stripPatronymic(tokens: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const lower = tokens[i].toLocaleLowerCase("az");
    if (AZ_PATRONYMIC_MARKERS.has(lower)) {
      result.pop(); // drop the father's name preceding the marker
      continue;
    }
    if (tokens.length >= 3 && i > 0 && RU_PATRONYMIC.test(lower)) continue;
    result.push(tokens[i]);
  }
  return result;
}

/* ------------------------------ Variant set ------------------------------- */

/**
 * Bounded set of plausible search variants for a name in AZ/EN/RU.
 * Order: original first, then the most common renderings.
 */
export function generateNameVariants(fullName: string, max = 8): NameVariant[] {
  const name = normaliseName(fullName);
  const tokens = stripPatronymic(name.tokens);
  const core = tokens.join(" ");
  const variants: NameVariant[] = [];
  const seen = new Set<string>();
  const push = (text: string, script: NameVariant["script"], language: NameVariant["language"], kind: NameVariant["kind"]) => {
    const clean = text.replace(/\s+/g, " ").trim();
    const key = normaliseForMatch(clean);
    if (!clean || seen.has(key)) return;
    seen.add(key);
    variants.push({ text: clean, script, language, kind });
  };

  if (name.script === "cyrillic") {
    push(core, "cyrillic", "ru", "original");
    push(cyrillicToLatin(core), "latin", "en", "transliteration");
    // English press spelling of "дж" (Джавид → Javid).
    push(cyrillicToLatin(core).replace(/Dzh/g, "J").replace(/dzh/g, "j"), "latin", "en", "transliteration");
    for (const az of cyrillicToAzCandidates(core)) push(az, "latin", "az", "transliteration");
  } else {
    const isAz = looksAzerbaijaniLatin(core);
    push(core, "latin", isAz ? "az" : "en", "original");
    if (isAz) {
      push(azToEnglish(core), "latin", "en", "transliteration");
      push(azToAsciiPreservingLetters(core), "latin", "en", "transliteration");
      push(azToCyrillic(core), "cyrillic", "ru", "transliteration");
    } else if (looksRegionalLatin(core)) {
      const azCandidates = englishToAzCandidates(core);
      for (const az of azCandidates.slice(0, 2)) push(az, "latin", "az", "transliteration");
      push(latinToCyrillic(core), "cyrillic", "ru", "transliteration");
      const strongestAz = azCandidates.find((c) => /[əıQ]/.test(c));
      if (strongestAz) push(azToCyrillic(strongestAz), "cyrillic", "ru", "transliteration");
    }
  }
  return variants.slice(0, max);
}

/* ------------------------------- Matching --------------------------------- */

/** ASCII rendering used for comparison across scripts. */
export function toComparableAscii(input: string): string {
  const latin = detectScript(input) === "latin" ? input : cyrillicToLatin(input);
  const ascii = normaliseForMatch(azToEnglish(latin)).replace(/[^a-z\s-]/g, "");
  return ascii
    .split(/\s+/)
    .map((token) =>
      token
        // Russian "ы" (y) and Azerbaijani "ı" (i) between consonants.
        .replace(/(?<=[^aeiouy])y(?=[^aeiouy]|$)/g, "i")
        .replace(/^mamed/, "mammad")
        .replace(/^guseyn/, "huseyn")
        .replace(/^gasan/, "hasan")
        .replace(/^gadzhi/, "haji"),
    )
    .join(" ");
}

/**
 * Coarse phonetic key: first letter + consonant skeleton after folding common
 * AZ/EN/RU spelling alternations. Used for fuzzy candidate retrieval only.
 */
export function phoneticKey(token: string): string {
  let s = toComparableAscii(token).replace(/[^a-z]/g, "");
  if (!s) return "";
  s = s
    .replace(/shch/g, "s")
    .replace(/dzh/g, "j")
    .replace(/kh/g, "h")
    .replace(/x/g, "h")
    .replace(/gh/g, "g")
    .replace(/q/g, "g")
    .replace(/zh/g, "j")
    .replace(/ch/g, "C")
    .replace(/sh/g, "s")
    .replace(/ts/g, "s")
    .replace(/c/g, "j")
    .replace(/C/g, "c")
    .replace(/w/g, "v")
    .replace(/y/g, "i");
  const first = s[0];
  const skeleton = s
    .slice(1)
    .replace(/[aeiou]/g, "")
    .replace(/(.)\1+/g, "$1");
  return `${first}${skeleton}`;
}

export function nameTokensForMatch(input: string): string[] {
  return stripPatronymic(normaliseName(input).tokens).map((t) => t.replace(/[.,;:()]/g, "")).filter(Boolean);
}

export type NameMatchLevel = "exact" | "variant" | "phonetic" | "none";

/**
 * Compare a queried name with a name found in a source.
 * - exact: same letters ignoring case/diacritic noise
 * - variant: same after transliteration to a common ASCII form, or equal to a generated variant
 * - phonetic: same consonant skeleton per token (weak; never sufficient alone)
 */
export function compareNames(query: string, candidate: string, queryVariants?: string[]): NameMatchLevel {
  const qTokens = nameTokensForMatch(query);
  const cTokens = nameTokensForMatch(candidate);
  if (qTokens.length === 0 || cTokens.length === 0) return "none";
  const sortJoin = (tokens: string[], fn: (t: string) => string) => tokens.map(fn).sort().join(" ");

  if (sortJoin(qTokens, normaliseForMatch) === sortJoin(cTokens, normaliseForMatch)) return "exact";

  const variants = queryVariants ?? generateNameVariants(query).map((v) => v.text);
  const cNorm = sortJoin(cTokens, normaliseForMatch);
  if (variants.some((v) => sortJoin(nameTokensForMatch(v), normaliseForMatch) === cNorm)) return "variant";
  if (sortJoin(qTokens, toComparableAscii) === sortJoin(cTokens, toComparableAscii)) return "variant";

  if (qTokens.length === cTokens.length && sortJoin(qTokens, phoneticKey) === sortJoin(cTokens, phoneticKey)) {
    return "phonetic";
  }
  return "none";
}

/** True when every token of `nameForm` has a phonetic match among the query tokens. */
export function queryMentionsName(query: string, nameForm: string): boolean {
  const queryKeys = new Set(
    query
      .replace(/["“”«»]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(phoneticKey),
  );
  const formTokens = nameTokensForMatch(nameForm);
  return formTokens.length > 0 && formTokens.every((t) => queryKeys.has(phoneticKey(t)));
}

/** Initials for avatar fallbacks (never a generated face). */
export function initials(name: string): string {
  const tokens = stripPatronymic(normaliseName(name).tokens);
  const first = tokens[0]?.[0] ?? "";
  const last = tokens.length > 1 ? tokens[tokens.length - 1][0] : "";
  return `${first}${last}`.toLocaleUpperCase("az");
}
