import { createNote } from "@/lib/data/profiles";
import { ApiError, authed, idParam, json, readBody } from "@/lib/api/v1/http";
import { NoteRequestSchema } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** Add a private note (kept apart from sourced facts and excluded from exports by default). */
export const POST = authed<{ profileId: string }>(async (ctx, { profileId }) => {
  const id = idParam(profileId, "Profile not found.");
  const { body } = await readBody(ctx.request, NoteRequestSchema);
  const note = await createNote(ctx.db, ctx.viewer.userId, id, body);
  if (!note) throw new ApiError("not_found", "Profile not found.");
  return json(note, { status: 201 });
});
