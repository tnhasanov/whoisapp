import type { InformationGap } from "../domain";

type Translate = (key: string, values?: Record<string, string>) => string;

const KNOWN_GAPS = new Set(["no_education", "no_contacts", "no_accounts", "no_connections", "no_direct_news", "no_role", "role_not_current", "budget_limited"]);

/**
 * Deterministic gaps carry a code and are shown in the interface language
 * (Gaps.*). Gaps written by the model keep their stored text.
 */
export function gapText(gap: InformationGap, t: Translate, category: Translate): string {
  if (KNOWN_GAPS.has(gap.code)) return t(gap.code);
  const failed = /^search_failed_(\w+)$/.exec(gap.code);
  if (failed) return t("search_failed", { category: category(failed[1]) });
  return gap.text;
}
