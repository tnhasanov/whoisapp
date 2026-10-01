import type { IdentityResolution } from "@/lib/db/schema";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** How the identity was resolved, in the interface language (Identity.methods.*). */
export function identityReason(resolution: IdentityResolution, t: Translate): string {
  if (resolution.method === "auto_unique_company_match") {
    const company = resolution.params?.company;
    return company ? t("auto_unique_company_match", { company, domains: resolution.params?.domains ?? 0 }) : resolution.reason;
  }
  return t(resolution.method);
}
