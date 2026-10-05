import { z } from "zod";

/**
 * The research search form, validated identically in the browser, the mobile
 * app and on the server. Field errors are message codes (Errors.fields.*) so
 * each interface shows them in its own language.
 */

export const SEARCH_FIELD_ERROR_CODES = ["name_required", "too_long", "url_scheme", "url_credentials", "url_private", "invalid"] as const;
export type SearchFieldErrorCode = (typeof SEARCH_FIELD_ERROR_CODES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "too_long")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const SearchInputSchema = z.object({
  fullName: z
    .string({ error: "name_required" })
    .trim()
    .min(2, "name_required")
    .max(120, "too_long")
    .refine((v) => /\p{L}/u.test(v), "name_required"),
  company: optionalText(120),
  country: optionalText(60),
  profileUrl: optionalText(2048),
});

export type SearchInput = z.input<typeof SearchInputSchema>;
export type SearchFields = z.output<typeof SearchInputSchema>;

/**
 * Quick client-side check of the optional profile link (scheme and embedded
 * credentials). The server additionally rejects private and local addresses.
 */
export function profileUrlProblem(value: string | null | undefined): SearchFieldErrorCode | null {
  const input = value?.trim();
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`);
  } catch {
    return "url_scheme";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "url_scheme";
  if (url.username || url.password) return "url_credentials";
  return null;
}

/** Field → message code for the first problem with each field (null when valid). */
export function searchFieldErrors(raw: SearchInput): Record<string, SearchFieldErrorCode> | null {
  const parsed = SearchInputSchema.safeParse(raw);
  const errors: Record<string, SearchFieldErrorCode> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      const code = (SEARCH_FIELD_ERROR_CODES as readonly string[]).includes(issue.message) ? (issue.message as SearchFieldErrorCode) : "invalid";
      errors[field] ??= code;
    }
  }
  const urlProblem = profileUrlProblem(raw.profileUrl ?? null);
  if (urlProblem) errors.profileUrl ??= urlProblem;
  return Object.keys(errors).length > 0 ? errors : null;
}
