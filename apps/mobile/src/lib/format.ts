/** Host name without "www." for compact source labels. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** BCP 47 tag for text in a source language (used for screen reader pronunciation). */
export function langOf(code: string | null | undefined): string | null {
  return code === "az" || code === "en" || code === "ru" || code === "tr" ? code : null;
}
