import { reportIssue } from "@/lib/data/profiles";
import { ApiError, authed, idParam, json, readBody } from "@/lib/api/v1/http";
import { ReportIssueRequestSchema } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** "Report an issue" with a fact or the whole profile (incorrect, outdated, wrong person, privacy). */
export const POST = authed<{ profileId: string }>(async (ctx, { profileId }) => {
  const id = idParam(profileId, "Profile not found.");
  const input = await readBody(ctx.request, ReportIssueRequestSchema);
  const ok = await reportIssue(ctx.db, ctx.viewer.userId, {
    profileId: id,
    snapshotId: input.snapshotId ?? null,
    claimId: input.claimId ?? null,
    category: input.category,
    message: input.message,
  });
  if (!ok) throw new ApiError("not_found", "Profile not found.");
  return json({ ok: true }, { status: 201 });
});
