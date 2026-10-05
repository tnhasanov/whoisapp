import { findFixtureDocument } from "@/fixtures/world";
import { ApiError, authed, json } from "@/lib/api/v1/http";
import type { DemoSource } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** A fictional demo source page. Demo URLs use reserved example domains, so the app shows the text itself. */
export const GET = authed<{ key: string }>(async (_ctx, { key }) => {
  const doc = /^[a-z0-9-]{1,120}$/.test(key) ? findFixtureDocument(key) : undefined;
  if (!doc) throw new ApiError("not_found", "Source not found.");
  const body: DemoSource = {
    key: doc.key,
    url: doc.url,
    title: doc.title,
    publisher: doc.publisher,
    language: doc.language,
    sourceType: doc.sourceType,
    publishedDate: doc.publishedDate === "@run-date" ? null : doc.publishedDate,
    publishedOnRunDate: doc.publishedDate === "@run-date",
    access: doc.access,
    body: doc.body,
    snippet: doc.snippet,
  };
  return json(body);
});
