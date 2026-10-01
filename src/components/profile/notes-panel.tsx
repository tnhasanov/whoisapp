"use client";

import { Lock, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addNoteAction, addTagAction, deleteNoteAction, removeTagAction, updateNoteAction } from "@/app/actions/profile";
import { useEvidence } from "@/components/evidence/evidence-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { useDateFormat } from "@/lib/i18n/use-date-format";

export function NotesPanel() {
  const { view } = useEvidence();
  const t = useTranslations("Profile");
  const tCommon = useTranslations("Common");
  const fmtDate = useDateFormat();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const [tag, setTag] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const profileId = view.profile.id;

  const refresh = () => router.refresh();

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5 text-muted" aria-hidden />
        <h2 className="label-caps">{t("tags")}</h2>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("tags")}>
        {view.tags.map((tg) => (
          <li key={tg.id} className="inline-flex items-center gap-1 rounded-full bg-slate-soft py-0.5 pl-2.5 pr-1 text-[12px] font-medium text-ink-2">
            <Tag className="h-3 w-3" aria-hidden />
            {tg.name}
            <button
              type="button"
              className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"
              aria-label={t("removeTag", { name: tg.name })}
              disabled={pending}
              onClick={() => start(async () => { await removeTagAction(profileId, tg.id); refresh(); })}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tag.trim()) return;
          start(async () => {
            await addTagAction(profileId, tag);
            setTag("");
            refresh();
          });
        }}
      >
        <label htmlFor="new-tag" className="sr-only">
          {t("addTag")}
        </label>
        <Input id="new-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t("tagPlaceholder")} maxLength={40} className="h-8 text-[13px]" list="tag-suggestions" />
        <datalist id="tag-suggestions">
          {view.allTags.filter((a) => !view.tags.some((x) => x.id === a.id)).map((a) => (
            <option key={a.id} value={a.name} />
          ))}
        </datalist>
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !tag.trim()}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">{t("addTag")}</span>
        </Button>
      </form>

      <div className="mt-6 flex items-center gap-2">
        <Lock className="h-3.5 w-3.5 text-muted" aria-hidden />
        <h2 className="label-caps">{t("notes")}</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{t("notesHint")}</p>
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          start(async () => {
            await addNoteAction(profileId, draft);
            setDraft("");
            refresh();
          });
        }}
      >
        <label htmlFor="new-note" className="sr-only">
          {t("addNote")}
        </label>
        <Textarea id="new-note" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("notePlaceholder")} maxLength={5000} rows={3} />
        <Button type="submit" size="sm" disabled={pending || !draft.trim()}>
          {t("addNote")}
        </Button>
      </form>
      <ul className="mt-4 space-y-3">
        {view.notes.length === 0 ? <li className="text-sm text-muted">{t("noNotes")}</li> : null}
        {view.notes.map((n) => (
          <li key={n.id} className="rounded-md border border-line bg-surface-2 p-3">
            {editing === n.id ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    await updateNoteAction(profileId, n.id, editText);
                    setEditing(null);
                    refresh();
                  });
                }}
              >
                <label htmlFor={`edit-${n.id}`} className="sr-only">
                  {tCommon("edit")}
                </label>
                <Textarea id={`edit-${n.id}`} value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={pending || !editText.trim()}>
                    {tCommon("save")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    {tCommon("cancel")}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{n.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-subtle">{fmtDate(n.updatedAt, "dateTime")}</span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink"
                      aria-label={tCommon("edit")}
                      onClick={() => {
                        setEditing(n.id);
                        setEditText(n.body);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
                      aria-label={tCommon("delete")}
                      disabled={pending}
                      onClick={() => start(async () => { await deleteNoteAction(profileId, n.id); refresh(); })}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
