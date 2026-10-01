import { describe, expect, it } from "vitest";
import type { DraftSnapshot } from "@/lib/research/pipeline/assemble";
import { overviewWithoutNarrative, validateSynthesis } from "@/lib/research/pipeline/synthesis";
import type { SynthesisOutput } from "@/lib/research/schemas";

/** validateSynthesis only reads claim/media IDs and the deterministic gaps. */
const DRAFT = {
  claims: [{ tempId: "C1" }, { tempId: "C2" }],
  stories: [{ items: [{ tempId: "M1" }, { tempId: "M2" }] }, { items: [{ tempId: "M3" }] }],
  gaps: [
    { code: "no_contacts", text: "No public business contact found." },
    { code: "no_education", text: "No published education history was found." },
  ],
} as unknown as DraftSnapshot;

function output(parts: Partial<SynthesisOutput>): SynthesisOutput {
  return { summary: [], key_developments: [], gaps: [], questions: [], ...parts };
}

describe("validateSynthesis: summary", () => {
  it("keeps grounded sentences and strips unknown or duplicate IDs", () => {
    const overview = validateSynthesis(
      output({ summary: [{ text: "She leads Caspian Lantern Analytics.", claim_ids: ["C1", "C9", "C1"], media_ids: ["M7", "M1"], kind: "sourced" }] }),
      DRAFT,
    );
    expect(overview.summary).toEqual([{ text: "She leads Caspian Lantern Analytics.", claimIds: ["C1"], mediaIds: ["M1"], kind: "sourced" }]);
    expect(overview.narrativeAvailable).toBe(true);
  });

  it("drops sentences that cite no valid ID", () => {
    const overview = validateSynthesis(
      output({
        summary: [
          { text: "Unsupported claim about her.", claim_ids: ["C42"], media_ids: ["M42"], kind: "sourced" },
          { text: "Another unsupported sentence.", claim_ids: [], media_ids: [], kind: "sourced" },
        ],
      }),
      DRAFT,
    );
    expect(overview.summary).toEqual([]);
    expect(overview.narrativeAvailable).toBe(false);
  });

  it("keeps inferred commentary only when it is grounded", () => {
    const overview = validateSynthesis(
      output({
        summary: [
          { text: "Her recent funding suggests a focus on growth.", claim_ids: [], media_ids: ["M2"], kind: "inferred" },
          { text: "She is probably very ambitious.", claim_ids: [], media_ids: [], kind: "inferred" },
          { text: "She seems well connected.", claim_ids: ["C99"], media_ids: [], kind: "inferred" },
        ],
      }),
      DRAFT,
    );
    expect(overview.summary).toEqual([{ text: "Her recent funding suggests a focus on growth.", claimIds: [], mediaIds: ["M2"], kind: "inferred" }]);
  });

  it("drops empty sentences, clips long ones and keeps at most eight", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ text: `Sentence ${i}.`, claim_ids: ["C1"], media_ids: [], kind: "sourced" as const }));
    const overview = validateSynthesis(
      output({ summary: [{ text: "   ", claim_ids: ["C1"], media_ids: [], kind: "sourced" }, { text: "word ".repeat(200), claim_ids: ["C2"], media_ids: [], kind: "sourced" }, ...many] }),
      DRAFT,
    );
    expect(overview.summary).toHaveLength(8);
    expect(overview.summary[0].text.length).toBeLessThanOrEqual(601);
    expect(overview.summary[0].text.endsWith("…")).toBe(true);
  });
});

describe("validateSynthesis: key developments and questions", () => {
  it("keeps only grounded key developments and validates their dates", () => {
    const overview = validateSynthesis(
      output({
        key_developments: [
          { text: "Raised $4m.", media_ids: ["M1"], claim_ids: [], date: "2026-03" },
          { text: "Opened an office.", media_ids: ["M3"], claim_ids: ["C2"], date: "March 2026" },
          { text: "Unsupported development.", media_ids: ["M9"], claim_ids: [], date: "2026" },
        ],
      }),
      DRAFT,
    );
    expect(overview.keyDevelopments).toEqual([
      { text: "Raised $4m.", claimIds: [], mediaIds: ["M1"], date: { year: 2026, month: 3, day: null, approximate: undefined } },
      { text: "Opened an office.", claimIds: ["C2"], mediaIds: ["M3"], date: null },
    ]);
  });

  it("drops ungrounded questions and keeps at most five", () => {
    const grounded = Array.from({ length: 7 }, (_, i) => ({ question: `Question ${i}?`, claim_ids: ["C1"], media_ids: [] }));
    const overview = validateSynthesis(output({ questions: [{ question: "What is she hiding?", claim_ids: [], media_ids: [] }, ...grounded] }), DRAFT);
    expect(overview.questions).toHaveLength(5);
    expect(overview.questions[0]).toEqual({ question: "Question 0?", claimIds: ["C1"], mediaIds: [] });
  });
});

describe("validateSynthesis: gaps", () => {
  it("appends model gaps after the deterministic ones, skipping repeats", () => {
    const overview = validateSynthesis(
      output({
        gaps: [
          { text: "no public business contact found." },
          { text: "No board memberships were found." },
          { text: "No board memberships were found." },
          { text: "NO BOARD MEMBERSHIPS WERE FOUND." },
          { text: "No speaking engagements since 2024 were found." },
          { text: "   " },
        ],
      }),
      DRAFT,
    );
    expect(overview.gaps).toEqual([
      { code: "no_contacts", text: "No public business contact found." },
      { code: "no_education", text: "No published education history was found." },
      { code: "model_gap_1", text: "No board memberships were found." },
      { code: "model_gap_2", text: "No speaking engagements since 2024 were found." },
    ]);
  });

  it("keeps at most four model gaps", () => {
    const overview = validateSynthesis(output({ gaps: Array.from({ length: 6 }, (_, i) => ({ text: `Gap ${i}` })) }), DRAFT);
    expect(overview.gaps.filter((g) => g.code.startsWith("model_gap"))).toHaveLength(4);
  });
});

describe("overviewWithoutNarrative", () => {
  it("keeps the deterministic gaps and no narrative", () => {
    expect(overviewWithoutNarrative(DRAFT)).toEqual({
      summary: [],
      keyDevelopments: [],
      gaps: DRAFT.gaps,
      questions: [],
      narrativeAvailable: false,
    });
  });
});
