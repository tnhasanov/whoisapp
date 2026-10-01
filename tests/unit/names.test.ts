import { describe, expect, it } from "vitest";
import {
  azToCyrillic,
  azToEnglish,
  compareNames,
  cyrillicToAzCandidates,
  cyrillicToLatin,
  detectScript,
  englishToAzCandidates,
  generateNameVariants,
  initials,
  latinToCyrillic,
  looksAzerbaijaniLatin,
  normaliseName,
  phoneticKey,
  queryMentionsName,
  stripPatronymic,
} from "@/lib/names";

const texts = (name: string, max?: number) => generateNameVariants(name, max).map((v) => v.text);

describe("normaliseName", () => {
  it("trims, collapses whitespace and removes zero-width characters and quotes", () => {
    const n = normaliseName("  Elnara​   «Gasimova»  ");
    expect(n.display).toBe("Elnara Gasimova");
    expect(n.tokens).toEqual(["Elnara", "Gasimova"]);
    expect(n.script).toBe("latin");
  });

  it("keeps the original input and preserves Azerbaijani letters", () => {
    const n = normaliseName("Elnarə  Qasımova");
    expect(n.original).toBe("Elnarə  Qasımova");
    expect(n.display).toBe("Elnarə Qasımova");
  });

  it("composes decomposed characters (NFC)", () => {
    expect(normaliseName("Élnara").display).toBe("Élnara");
  });
});

describe("detectScript", () => {
  it("classifies Latin, Cyrillic, mixed and other input", () => {
    expect(detectScript("Elnara Gasimova")).toBe("latin");
    expect(detectScript("Elnarə Qasımova")).toBe("latin");
    expect(detectScript("Эльнара Гасымова")).toBe("cyrillic");
    expect(detectScript("Эльнара Gasimova")).toBe("mixed");
    expect(detectScript("123 !")).toBe("other");
  });
});

describe("cyrillicToLatin", () => {
  it("transliterates Russian renderings of Azerbaijani names", () => {
    expect(cyrillicToLatin("Эльнара Гасымова")).toBe("Elnara Gasymova");
    expect(cyrillicToLatin("Щукин Юрий")).toBe("Shchukin Yuriy");
  });

  it('writes post-vowel "е" as "ye" but word-initial "е" as "e"', () => {
    expect(cyrillicToLatin("Алиева")).toBe("Aliyeva");
    expect(cyrillicToLatin("Елена")).toBe("Elena");
  });

  it("leaves non-Cyrillic characters untouched", () => {
    expect(cyrillicToLatin("Мамедов-Алиев 2020")).toBe("Mamedov-Aliyev 2020");
  });
});

describe("azToEnglish", () => {
  it("maps Azerbaijani letters to common English press spellings", () => {
    expect(azToEnglish("Elnarə Qasımova")).toBe("Elnara Gasimova");
    expect(azToEnglish("Cavid Nuriyev")).toBe("Javid Nuriyev");
    expect(azToEnglish("Tural Xəlilov")).toBe("Tural Khalilov");
    expect(azToEnglish("Şəhla Çələbi")).toBe("Shahla Chalabi");
    expect(azToEnglish("Gündüz Ağayev")).toBe("Gunduz Aghayev");
  });
});

describe("azToCyrillic", () => {
  it("produces conventional Russian renderings", () => {
    expect(azToCyrillic("Elnarə Qasımova")).toBe("Эльнара Гасымова");
    expect(azToCyrillic("Cavid Nuriyev")).toBe("Джавид Нуриев");
    expect(azToCyrillic("Tural Xəlilov")).toBe("Турал Халилов");
  });

  it("uses fixed Russian forms for common name parts", () => {
    expect(azToCyrillic("Məmməd Əliyev")).toBe("Мамед Алиев");
    expect(azToCyrillic("Hüseyn Həsənov")).toBe("Гусейн Гасанов");
  });

  it("keeps hyphenated surnames hyphenated", () => {
    expect(azToCyrillic("Elnara Qasımova-Əliyeva")).toBe("Эльнара Гасымова-Алиева");
  });
});

describe("latinToCyrillic", () => {
  it("renders English press spellings in Cyrillic", () => {
    expect(latinToCyrillic("Elnara Gasimova")).toBe("Эльнара Гасимова");
    expect(latinToCyrillic("Javid Nuriyev")).toBe("Джавид Нуриев");
    expect(latinToCyrillic("Shahla Khalilova")).toBe("Шахла Халилова");
    expect(latinToCyrillic("Mammad Aliyev")).toBe("Мамед Алиев");
  });
});

describe("englishToAzCandidates", () => {
  it("suggests Azerbaijani spellings for an English press spelling", () => {
    const out = englishToAzCandidates("Elnara Gasimova");
    expect(out).toContain("Elnarə Qasımova");
    expect(out).toContain("Elnara Qasımova");
    expect(out).not.toContain("Elnara Gasimova");
  });

  it("maps J to C and common surname shapes", () => {
    expect(englishToAzCandidates("Javid Nuriyev")).toEqual(["Cavid Nuriyev"]);
    expect(englishToAzCandidates("Mammad Aliyev")).toEqual(["Mammad Əliyev"]);
  });

  it("returns nothing for a single name with no plausible alternative", () => {
    expect(englishToAzCandidates("Madonna")).toEqual([]);
  });
});

describe("cyrillicToAzCandidates", () => {
  it("suggests Azerbaijani Latin spellings for a Russian rendering", () => {
    const out = cyrillicToAzCandidates("Эльнара Гасымова");
    expect(out).toContain("Elnara Qasımova");
    // The plain Latin transliteration is not repeated here.
    expect(out).not.toContain("Elnara Gasymova");
  });
});

describe("stripPatronymic", () => {
  it("drops Azerbaijani patronymics (father's name + qızı/oğlu)", () => {
    expect(stripPatronymic(["Elnara", "Rauf", "qızı", "Qasımova"])).toEqual(["Elnara", "Qasımova"]);
    expect(stripPatronymic(["Javid", "Ali", "oglu", "Nuriyev"])).toEqual(["Javid", "Nuriyev"]);
  });

  it("drops Russian patronymics in three-part names", () => {
    expect(stripPatronymic(["Гасымова", "Эльнара", "Рауфовна"])).toEqual(["Гасымова", "Эльнара"]);
  });

  it("keeps two-part names and leading tokens that only look like patronymics", () => {
    expect(stripPatronymic(["Иван", "Петрович"])).toEqual(["Иван", "Петрович"]);
    expect(stripPatronymic(["Иванович", "Пётр", "Сидоров"])).toEqual(["Иванович", "Пётр", "Сидоров"]);
  });
});

describe("generateNameVariants", () => {
  it("puts the original first and stays within the requested bound", () => {
    const variants = generateNameVariants("Elnara Gasimova");
    expect(variants[0]).toEqual({ text: "Elnara Gasimova", script: "latin", language: "en", kind: "original" });
    expect(variants.length).toBeLessThanOrEqual(8);
    expect(variants.slice(1).every((v) => v.kind === "transliteration")).toBe(true);
    expect(generateNameVariants("Elnara Gasimova", 2)).toHaveLength(2);
  });

  it("covers Azerbaijani and Russian renderings of an English spelling", () => {
    const variants = generateNameVariants("Elnara Gasimova");
    expect(variants.map((v) => v.text)).toContain("Elnarə Qasımova");
    expect(variants.find((v) => v.text === "Elnarə Qasımova")?.language).toBe("az");
    const cyrillic = variants.filter((v) => v.script === "cyrillic");
    expect(cyrillic.length).toBeGreaterThan(0);
    expect(cyrillic.every((v) => v.language === "ru")).toBe(true);
    expect(cyrillic.map((v) => v.text)).toContain("Эльнара Гасымова");
  });

  it("detects Azerbaijani spellings without special letters", () => {
    expect(looksAzerbaijaniLatin("Cavid Nuriyev")).toBe(true);
    const variants = generateNameVariants("Cavid Nuriyev");
    expect(variants[0]).toMatchObject({ text: "Cavid Nuriyev", language: "az", kind: "original" });
    expect(variants.map((v) => v.text)).toEqual(expect.arrayContaining(["Javid Nuriyev", "Джавид Нуриев"]));
  });

  it("does not treat an English spelling as Azerbaijani", () => {
    expect(looksAzerbaijaniLatin("Elnara Gasimova")).toBe(false);
    expect(looksAzerbaijaniLatin("Elnarə Qasımova")).toBe(true);
  });

  it("starts from the Cyrillic original for Russian input", () => {
    const variants = generateNameVariants("Эльнара Гасымова");
    expect(variants[0]).toMatchObject({ text: "Эльнара Гасымова", script: "cyrillic", language: "ru", kind: "original" });
    expect(variants.map((v) => v.text)).toEqual(expect.arrayContaining(["Elnara Gasymova", "Elnara Qasımova"]));
  });

  it("removes patronymics before generating variants", () => {
    expect(texts("Elnara Rauf qızı Qasımova")[0]).toBe("Elnara Qasımova");
    expect(texts("Гасымова Эльнара Рауфовна")[0]).toBe("Гасымова Эльнара");
  });

  it("never returns duplicate variants (after match normalisation)", () => {
    for (const name of ["Elnara Gasimova", "Cavid Nuriyev", "Эльнара Гасымова", "Məmməd Əliyev", "Leyla Mammadova"]) {
      const keys = texts(name).map((t) => t.toLowerCase().replace(/ı/g, "i"));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("phoneticKey", () => {
  it("folds AZ/EN/RU spellings of the same name onto one key", () => {
    expect(phoneticKey("Gasimova")).toBe(phoneticKey("Qasımova"));
    expect(phoneticKey("Gasimova")).toBe(phoneticKey("Гасымова"));
    expect(phoneticKey("Javid")).toBe(phoneticKey("Cavid"));
    expect(phoneticKey("Javid")).toBe(phoneticKey("Джавид"));
    expect(phoneticKey("Khalilov")).toBe(phoneticKey("Xəlilov"));
    expect(phoneticKey("Khalilov")).toBe(phoneticKey("Халилов"));
  });

  it("keeps different initial consonants apart", () => {
    expect(phoneticKey("Gasimova")).not.toBe(phoneticKey("Kasimova"));
  });

  it("returns an empty key for tokens without letters", () => {
    expect(phoneticKey("123")).toBe("");
  });
});

describe("compareNames", () => {
  it("is exact for the same letters regardless of case, spacing and token order", () => {
    expect(compareNames("Elnara Gasimova", "elnara   GASIMOVA")).toBe("exact");
    expect(compareNames("Elnara Gasimova", "Gasimova Elnara")).toBe("exact");
  });

  it("treats transliterations across scripts as variants", () => {
    expect(compareNames("Elnara Gasimova", "Эльнара Гасымова")).toBe("variant");
    expect(compareNames("Эльнара Гасымова", "Elnara Gasimova")).toBe("variant");
    expect(compareNames("Elnara Gasimova", "Elnarə Qasımova")).toBe("variant");
  });

  it("matches variants without a generated variant list (common ASCII form)", () => {
    expect(compareNames("Elnara Gasimova", "Elnara Qasimova", [])).toBe("variant");
    expect(compareNames("Elnara Gasimova", "Elnara Gasymova", [])).toBe("variant");
  });

  it("ignores patronymics on either side", () => {
    expect(compareNames("Elnara Gasimova", "Elnara Rauf qızı Gasimova")).toBe("exact");
    expect(compareNames("Гасымова Эльнара Рауфовна", "Elnara Gasimova")).toBe("variant");
  });

  it("returns phonetic only for weak similarity", () => {
    expect(compareNames("Elnara Gasimova", "Elnora Gasimova")).toBe("phonetic");
  });

  it("does not match a different surname", () => {
    expect(compareNames("Elnara Gasimova", "Elnara Kasimova")).toBe("none");
    expect(compareNames("Elnara Gasimova", "Leyla Gasimova")).toBe("none");
  });

  it("returns none for empty names", () => {
    expect(compareNames("", "Elnara Gasimova")).toBe("none");
    expect(compareNames("Elnara Gasimova", "   ")).toBe("none");
  });
});

describe("queryMentionsName", () => {
  it("is true when every token of the name form appears (in any script)", () => {
    expect(queryMentionsName('"Elnara Gasimova" "Caspian Lantern"', "Elnara Gasimova")).toBe(true);
    expect(queryMentionsName('"Elnarə Qasımova"', "Elnara Gasimova")).toBe(true);
    expect(queryMentionsName("«Эльнара Гасымова»", "Elnara Gasimova")).toBe(true);
  });

  it("is false when only part of the name or a different surname appears", () => {
    expect(queryMentionsName('"Elnara"', "Elnara Gasimova")).toBe(false);
    expect(queryMentionsName('"Elnara Kasimova"', "Elnara Gasimova")).toBe(false);
  });

  it("is false for an empty name form", () => {
    expect(queryMentionsName("Elnara Gasimova", "")).toBe(false);
  });
});

describe("initials", () => {
  it("uses the first and last name, ignoring patronymics", () => {
    expect(initials("Elnara Gasimova")).toBe("EG");
    expect(initials("Elnara Rauf qızı Qasımova")).toBe("EQ");
    expect(initials("Эльнара Гасымова")).toBe("ЭГ");
  });

  it("upper-cases with Azerbaijani rules and handles single or empty names", () => {
    expect(initials("ilkin əliyev")).toBe("İƏ");
    expect(initials("Madonna")).toBe("M");
    expect(initials("")).toBe("");
  });
});

describe("variants for names that are not regional", () => {
  it("does not invent Azerbaijani or Russian spellings for an English name", () => {
    expect(texts("John Smith")).toEqual(["John Smith"]);
    expect(texts("Maria Garcia")).toEqual(["Maria Garcia"]);
  });

  it("treats English 'Ch' as Ç, not as Azerbaijani C", () => {
    expect(looksAzerbaijaniLatin("Chingiz Aliyev")).toBe(false);
    expect(texts("Chingiz Aliyev")).toEqual(expect.arrayContaining(["Çingiz Əliyev", "Чингиз Алиев"]));
    expect(texts("Chingiz Aliyev")).not.toContain("Jhingiz Aliyev");
  });

  it("renders 'ey' as 'ей' and keeps English I as И", () => {
    expect(texts("Leyla Huseynzade")).toContain("Лейла Гусейнзаде");
    expect(texts("Leyla Huseynzade").some((v) => v.includes("Леыла"))).toBe(false);
    expect(texts("Anna Ivanova")).toContain("Анна Иванова");
    expect(texts("Anna Ivanova").some((v) => v.includes("Ыванова"))).toBe(false);
  });

  it("maps Russian 'Дж' to Azerbaijani C and English J", () => {
    expect(cyrillicToAzCandidates("Джавид Нуриев")).toContain("Cavid Nuriyev");
    expect(cyrillicToAzCandidates("Гусейн Джафаров")).toContain("Hüseyn Cafarov");
    expect(texts("Джавид Нуриев")).toEqual(expect.arrayContaining(["Javid Nuriyev", "Cavid Nuriyev"]));
  });
});
