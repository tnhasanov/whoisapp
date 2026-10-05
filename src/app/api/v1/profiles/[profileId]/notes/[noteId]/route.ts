import { deleteNote, editNote } from "@/lib/data/profiles";
import { ApiError, authed, idParam, json, noContent, readBody } from "@/lib/api/v1/http";
import { NoteRequestSchema } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

type Params = { profileId: string; noteId: string };

export const PATCH = authed<Params>(async (ctx, { profileId, noteId }) => {
  const { body } = await readBody(ctx.request, NoteRequestSchema);
  const note = await editNote(ctx.db, ctx.viewer.userId, idParam(noteId, "Note not found."), body, idParam(profileId, "Note not found."));
  if (!note) throw new ApiError("not_found", "Note not found.");
  return json(note);
});

export const DELETE = authed<Params>(async (ctx, { profileId, noteId }) => {
  if (!(await deleteNote(ctx.db, ctx.viewer.userId, idParam(noteId, "Note not found."), idParam(profileId, "Note not found.")))) throw new ApiError("not_found", "Note not found.");
  return noContent();
});
