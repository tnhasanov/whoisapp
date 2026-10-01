import { describe, expect, it } from "vitest";
import {
  comparePartialDates,
  formatPartialDate,
  formatPartialDateString,
  isValidPartialDateString,
  monthsBetween,
  parsePartialDate,
  partialDateEnd,
  partialDateSortKey,
  partialDateStart,
  partialDatesCompatible,
  partialDateToString,
  precisionOf,
} from "@/lib/dates/partial-date";

describe("parsePartialDate", () => {
  it("keeps the precision the source gave", () => {
    expect(parsePartialDate("2014")).toEqual({ year: 2014, month: null, day: null, approximate: undefined });
    expect(parsePartialDate("2014-06")).toEqual({ year: 2014, month: 6, day: null, approximate: undefined });
    expect(parsePartialDate("2014-06-03")).toEqual({ year: 2014, month: 6, day: 3, approximate: undefined });
  });

  it("marks approximate dates", () => {
    expect(parsePartialDate("2015", true)).toMatchObject({ year: 2015, approximate: true });
  });

  it("accepts ISO timestamps and trims whitespace", () => {
    expect(parsePartialDate("2014-06-03T10:00:00Z")).toMatchObject({ year: 2014, month: 6, day: 3 });
    expect(parsePartialDate("2014-06-03 10:00")).toMatchObject({ year: 2014, month: 6, day: 3 });
    expect(parsePartialDate(" 2014 ")).toMatchObject({ year: 2014, month: null });
  });

  it.each(["2014-13", "2014-00", "2014-02-30", "2015-02-29", "2014-06-00", "2014-04-31"])("rejects the impossible date %s", (input) => {
    expect(parsePartialDate(input)).toBeNull();
  });

  it("accepts 29 February in a leap year", () => {
    expect(parsePartialDate("2016-02-29")).toMatchObject({ year: 2016, month: 2, day: 29 });
  });

  it.each(["June 2014", "14", "2014-6", "2014-06-3", "2014-06-03X", "2014-06-031", "1899", "2101", "0000"])("rejects the malformed value %s", (input) => {
    expect(parsePartialDate(input)).toBeNull();
  });

  it("keeps unknown dates null (never today)", () => {
    expect(parsePartialDate(null)).toBeNull();
    expect(parsePartialDate(undefined)).toBeNull();
    expect(parsePartialDate("")).toBeNull();
  });
});

describe("isValidPartialDateString", () => {
  it("accepts exact partial ISO strings and null/undefined (unknown)", () => {
    for (const value of ["2014", "2014-06", "2014-06-03", null, undefined]) expect(isValidPartialDateString(value)).toBe(true);
  });

  it("rejects timestamps, impossible dates and free text", () => {
    for (const value of ["2014-06-03T10:00:00Z", "2014-13", "2014-02-30", "garbage", ""]) expect(isValidPartialDateString(value)).toBe(false);
  });
});

describe("precision and formatting to strings", () => {
  it("reports precision", () => {
    expect(precisionOf({ year: 2014 })).toBe("year");
    expect(precisionOf({ year: 2014, month: 6 })).toBe("month");
    expect(precisionOf({ year: 2014, month: 6, day: 3 })).toBe("day");
  });

  it("round-trips at the date's own precision", () => {
    for (const value of ["2014", "2014-06", "2014-06-03"]) expect(partialDateToString(parsePartialDate(value))).toBe(value);
    expect(partialDateToString(null)).toBeNull();
    expect(partialDateToString(undefined)).toBeNull();
  });
});

describe("partialDateStart / partialDateEnd", () => {
  it("spans the whole period", () => {
    expect(partialDateStart({ year: 2014 }).toISOString()).toBe("2014-01-01T00:00:00.000Z");
    expect(partialDateEnd({ year: 2014 }).toISOString()).toBe("2014-12-31T23:59:59.999Z");
    expect(partialDateStart({ year: 2016, month: 2 }).toISOString()).toBe("2016-02-01T00:00:00.000Z");
    expect(partialDateEnd({ year: 2016, month: 2 }).toISOString()).toBe("2016-02-29T23:59:59.999Z");
    expect(partialDateEnd({ year: 2014, month: 6, day: 3 }).toISOString()).toBe("2014-06-03T23:59:59.999Z");
  });
});

describe("comparePartialDates", () => {
  it("orders non-overlapping dates", () => {
    expect(comparePartialDates({ year: 2014 }, { year: 2015 })).toBe(-1);
    expect(comparePartialDates({ year: 2015 }, { year: 2014 })).toBe(1);
    expect(comparePartialDates({ year: 2014, month: 5 }, { year: 2014, month: 6 })).toBe(-1);
  });

  it("returns 0 only for the same date at the same precision", () => {
    expect(comparePartialDates({ year: 2014 }, { year: 2014 })).toBe(0);
    expect(comparePartialDates({ year: 2014, month: 6, day: 3 }, { year: 2014, month: 6, day: 3 })).toBe(0);
  });

  it("is undecidable (null) when one date contains the other", () => {
    expect(comparePartialDates({ year: 2014 }, { year: 2014, month: 6 })).toBeNull();
    expect(comparePartialDates({ year: 2014, month: 6 }, { year: 2014, month: 6, day: 3 })).toBeNull();
  });
});

describe("partialDatesCompatible", () => {
  it("treats a coarser date as compatible with a finer one inside it", () => {
    expect(partialDatesCompatible({ year: 2014 }, { year: 2014, month: 6 })).toBe(true);
    expect(partialDatesCompatible({ year: 2014, month: 6, day: 1 }, { year: 2014, month: 6 })).toBe(true);
  });

  it("treats a missing date as compatible", () => {
    expect(partialDatesCompatible(null, { year: 2014 })).toBe(true);
    expect(partialDatesCompatible(null, null)).toBe(true);
  });

  it("detects conflicts at any shared precision", () => {
    expect(partialDatesCompatible({ year: 2014 }, { year: 2015 })).toBe(false);
    expect(partialDatesCompatible({ year: 2014, month: 5 }, { year: 2014, month: 6 })).toBe(false);
    expect(partialDatesCompatible({ year: 2014, month: 6, day: 1 }, { year: 2014, month: 6, day: 2 })).toBe(false);
  });
});

describe("partialDateSortKey / monthsBetween", () => {
  it("sorts unknown dates last", () => {
    const keys = [partialDateSortKey(null), partialDateSortKey({ year: 2014, month: 6, day: 3 }), partialDateSortKey({ year: 2014 })];
    expect([...keys].sort()).toEqual(["2014-00-00", "2014-06-03", "9999-99-99"]);
  });

  it("counts calendar months", () => {
    expect(monthsBetween(new Date("2024-01-15T00:00:00Z"), new Date("2026-10-01T00:00:00Z"))).toBe(33);
    expect(monthsBetween(new Date("2025-04-30T00:00:00Z"), new Date("2026-10-01T00:00:00Z"))).toBe(18);
  });
});

describe("formatPartialDate", () => {
  it("never invents precision", () => {
    expect(formatPartialDate({ year: 2014 }, "en")).toBe("2014");
    expect(formatPartialDate({ year: 2014, month: 6 }, "en")).toBe("Jun 2014");
    expect(formatPartialDate({ year: 2014, month: 6, day: 3 }, "en")).toBe("Jun 3, 2014");
  });

  it("labels approximate dates", () => {
    expect(formatPartialDate({ year: 2014, approximate: true }, "en")).toBe("c. 2014");
  });

  it("shows the unknown label (or nothing) for unknown dates", () => {
    expect(formatPartialDate(null, "en", { unknownLabel: "Date unknown" })).toBe("Date unknown");
    expect(formatPartialDate(null, "en")).toBe("");
    expect(formatPartialDateString(null, "en", "Date unknown")).toBe("Date unknown");
    expect(formatPartialDateString("not a date", "en", "?")).toBe("?");
  });

  it("formats strings with the same rules", () => {
    expect(formatPartialDateString("2014-06", "en")).toBe("Jun 2014");
    expect(formatPartialDateString("2014", "ru")).toBe("2014");
  });
});
