/**
 * Where a source opens. Fictional demo sources open in the local fixture
 * viewer and are never linked as live websites.
 */
export function sourceHref(source: { url: string; fixtureKey?: string | null }): { href: string; external: boolean } {
  if (source.fixtureKey) return { href: `/demo/sources/${encodeURIComponent(source.fixtureKey)}`, external: false };
  return { href: source.url, external: true };
}

export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
