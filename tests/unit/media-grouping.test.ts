import { describe, expect, it } from "vitest";
import { groupStories, isSameStory, syndicationGroups, type GroupableItem } from "@/lib/media/grouping";

const WIRE_TEXT =
  "Caspian Lantern Analytics, a Baku data company led by chief executive Elnara Gasimova, said on Tuesday it had raised 4 million dollars from regional investors to expand its logistics forecasting platform across the Caspian region and Central Asia.";

function item(key: string, overrides: Partial<GroupableItem> = {}): GroupableItem {
  return {
    key,
    canonicalUrl: `https://${key}.example/story`,
    headline: "Caspian Lantern Analytics raises $4m to expand forecasting platform",
    language: "en",
    publishedAt: "2026-03-10",
    text: WIRE_TEXT,
    ...overrides,
  };
}

describe("groupStories", () => {
  it("groups syndicated near-identical copies with different headlines", () => {
    const groups = groupStories([
      item("wire"),
      item("daily", { headline: "Baku start-up secures funding", publishedAt: "2026-03-11", text: `${WIRE_TEXT} The company was founded in 2014.` }),
    ]);
    expect(groups).toEqual([["wire", "daily"]]);
  });

  it("groups copies with near-identical headlines in the same language", () => {
    const groups = groupStories([
      item("a", { text: "Short snippet one." }),
      item("b", { headline: "Caspian Lantern Analytics raises $4m to expand its forecasting platform", text: "Different snippet two." }),
    ]);
    expect(groups).toEqual([["a", "b"]]);
  });

  it("does not group different stories about the same person", () => {
    const groups = groupStories([
      item("funding"),
      item("forum", {
        headline: "Elnara Gasimova speaks at Baku tech forum",
        publishedAt: "2026-03-12",
        text: "At the forum, Elnara Gasimova discussed data governance and public transport analytics with officials and students from local universities.",
      }),
    ]);
    expect(groups).toEqual([["funding"], ["forum"]]);
  });

  it("does not group similar headlines in different languages without text overlap", () => {
    const groups = groupStories([
      item("en", { text: "English snippet only." }),
      item("ru", { language: "ru", text: "Русский текст заметки." }),
    ]);
    expect(groups).toEqual([["en"], ["ru"]]);
  });

  it("does not group copies published more than 7 days apart", () => {
    const groups = groupStories([item("march"), item("april", { publishedAt: "2026-03-18" })]);
    expect(groups).toEqual([["march"], ["april"]]);
    expect(groupStories([item("a"), item("b", { publishedAt: "2026-03-17" })])).toEqual([["a", "b"]]);
  });

  it("always groups items with the same canonical URL", () => {
    const groups = groupStories([
      item("a", { canonicalUrl: "https://wire.example/story-1" }),
      item("b", { canonicalUrl: "https://wire.example/story-1", headline: "Totally different", language: "ru", publishedAt: "2020-01-01", text: "x" }),
    ]);
    expect(groups).toEqual([["a", "b"]]);
  });

  it("groups transitively and keeps input order", () => {
    const groups = groupStories([
      item("first", { canonicalUrl: "https://one.example/x" }),
      item("unrelated", { headline: "Weather in Baku", text: "Sunny with light wind along the coast.", canonicalUrl: "https://two.example/y" }),
      item("second", { canonicalUrl: "https://three.example/z" }),
      item("copy-of-first", { canonicalUrl: "https://one.example/x" }),
    ]);
    expect(groups).toEqual([["first", "second", "copy-of-first"], ["unrelated"]]);
  });

  it("treats undated items as comparable", () => {
    expect(isSameStory(item("a", { publishedAt: null }), item("b", { publishedAt: "2026-03-10" }))).toBe(true);
  });
});

describe("syndicationGroups", () => {
  it("links documents by text overlap only", () => {
    const groups = syndicationGroups([
      { key: "A", text: WIRE_TEXT },
      { key: "B", text: `${WIRE_TEXT} Reporting by staff.` },
      { key: "C", text: "Completely unrelated material about a football match in Ganja and the weather afterwards." },
    ]);
    expect(Object.fromEntries(groups)).toEqual({ A: "syn:A", B: "syn:A" });
  });

  it("does not treat two different bios of people with the same name as syndication", () => {
    const groups = syndicationGroups([
      { key: "ceo", text: "Elnara Gasimova is a data scientist and the chief executive of Caspian Lantern Analytics in Baku." },
      { key: "painter", text: "Elnara Gasimova is a painter who works in Sumgayit and exhibits watercolours of the Absheron coast." },
    ]);
    expect(groups.size).toBe(0);
  });

  it("ignores very short texts", () => {
    expect(syndicationGroups([{ key: "a", text: "Elnara Gasimova, CEO" }, { key: "b", text: "Elnara Gasimova, CEO" }]).size).toBe(0);
  });
});
