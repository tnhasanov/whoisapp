"use client";

import { Bookmark, BookmarkCheck, ChevronDown, Download, Flag, GitCompareArrows, MapPin, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProfileAction, toggleSaveAction } from "@/app/actions/profile";
import { refreshProfileAction } from "@/app/actions/research";
import { CitationMarkers } from "@/components/evidence/evidence-trigger";
import { useEvidence } from "@/components/evidence/evidence-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Callout } from "@/components/ui/feedback";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { identityReason } from "@/lib/i18n/identity";
import { initials } from "@/lib/names";
import { useDateFormat } from "@/lib/i18n/use-date-format";

/** On phones, hand the PDF to the system share sheet (save to Files, AirDrop, mail…). */
async function sharePdf(href: string, title: string): Promise<void> {
  const response = await fetch(href, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`export failed: ${response.status}`);
  const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "personbrief.pdf";
  const file = new File([await response.blob()], name, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    });
  } else {
    download(href);
  }
}

function canSharePdf(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.canShare === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/** Exports are attachments: a temporary link downloads them without leaving the page. */
function download(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ProfileHeader() {
  const { view } = useEvidence();
  const t = useTranslations("Profile");
  const tCommon = useTranslations("Common");
  const tMethods = useTranslations("Identity.methods");
  const fmtDate = useDateFormat();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { profile, snapshot } = view;
  const isLatest = snapshot.id === profile.latestSnapshotId;
  const roleClaim = snapshot.headline.roleClaimId ? view.claims.find((c) => c.id === snapshot.headline.roleClaimId) : null;
  const locationClaim = snapshot.headline.locationClaimId ? view.claims.find((c) => c.id === snapshot.headline.locationClaimId) : null;
  const confirmedCurrent = roleClaim ? roleClaim.temporal.currency === "stated_current" && !roleClaim.temporal.possiblyOutdated : false;
  const saved = Boolean(profile.savedAt);
  const snapshotParam = isLatest ? "" : `&snapshot=${snapshot.id}`;
  const exportBase = `/api/profiles/${profile.id}/export?snapshot=${snapshot.id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-serif text-2xl font-semibold text-accent-ink sm:flex" aria-hidden>
            {initials(profile.displayName)}
          </div>
          <div className="min-w-0">
            <div className="label-caps mb-1 flex flex-wrap items-center gap-2">
              {t("eyebrow")}
              {profile.workspace === "demo" ? <Badge tone="demo">{t("demoFictional")}</Badge> : null}
              {snapshot.status === "partial" ? <Badge tone="warn">{t("partialBadge")}</Badge> : null}
            </div>
            <h1 className="font-serif text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[36px]">{profile.displayName}</h1>
            {profile.nativeName && profile.nativeName !== profile.displayName ? <p className="mt-1 font-serif text-lg text-muted">{profile.nativeName}</p> : null}
            <div className="mt-2 text-[15px] text-ink-2">
              {roleClaim && snapshot.headline.role ? (
                <p>
                  <span className="font-medium text-ink">{snapshot.headline.role}</span>
                  {snapshot.headline.organisation ? <span> · {snapshot.headline.organisation}</span> : null}
                  <CitationMarkers target={{ kind: "claim", id: roleClaim.id }} sourceIds={roleClaim.evidence.map((e) => e.sourceId)} label={roleClaim.displayValue} />
                  {!confirmedCurrent ? <span className="ml-2 align-middle text-xs text-warn">{t("latestRoleNotCurrent")}</span> : null}
                </p>
              ) : (
                <p className="text-muted">{t("noRole")}</p>
              )}
              <p className="mt-1 flex items-center gap-1 text-[13.5px] text-muted">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {locationClaim && snapshot.headline.location ? (
                  <>
                    {snapshot.headline.location}
                    <CitationMarkers target={{ kind: "claim", id: locationClaim.id }} sourceIds={locationClaim.evidence.map((e) => e.sourceId)} label={locationClaim.displayValue} />
                  </>
                ) : (
                  t("noLocation")
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button variant={saved ? "secondary" : "primary"} disabled={pending} onClick={() => start(() => toggleSaveAction(profile.id, !saved))} aria-pressed={saved}>
            {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
            {saved ? t("saved") : t("save")}
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            title={t("refreshHint")}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await refreshProfileAction(profile.id, crypto.randomUUID().replace(/-/g, ""));
                if (result?.error) setError(result.error);
              })
            }
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t("refresh")}
          </Button>
          <Menu
            trigger={
              <button type="button" className={buttonClasses("secondary", "md")}>
                <Download className="h-4 w-4" aria-hidden />
                {t("export")}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            }
          >
            <MenuLabel>{t("exportNotesNote")}</MenuLabel>
            {canSharePdf() ? (
              <MenuItem onSelect={() => void sharePdf(`${exportBase}&format=pdf`, profile.displayName).catch(() => setError(tCommon("error")))}>
                {t("sharePdf")}
              </MenuItem>
            ) : null}
            <MenuItem onSelect={() => download(`${exportBase}&format=pdf`)}>{t("exportPdf")}</MenuItem>
            <MenuItem onSelect={() => download(`${exportBase}&format=json`)}>{t("exportJson")}</MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={() => download(`${exportBase}&format=json&notes=1`)}>{t("exportWithNotes")}</MenuItem>
          </Menu>
          <Menu
            trigger={
              <button type="button" className={buttonClasses("ghost", "icon")} aria-label={tCommon("more")} title={tCommon("more")}>
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </button>
            }
          >
            <MenuItem onSelect={() => router.push(`/profiles/${profile.id}/report?snapshot=${snapshot.id}`)}>
              <Flag className="h-4 w-4" aria-hidden />
              {t("reportIssue")}
            </MenuItem>
          </Menu>
          <ConfirmDialog
            trigger={
              <button type="button" className={buttonClasses("ghost", "icon", "text-danger hover:bg-danger-soft hover:text-danger")} aria-label={t("delete")} title={t("delete")}>
                <Trash2 className="h-4.5 w-4.5" aria-hidden />
              </button>
            }
            title={t("deleteTitle")}
            description={t("deleteBody")}
            confirmLabel={t("deleteConfirm")}
            cancelLabel={tCommon("cancel")}
            destructive
            onConfirm={() => start(() => deleteProfileAction(profile.id))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-2.5 text-[13px] text-muted">
        <span>{t("researched", { date: fmtDate(snapshot.researchedAt, "dateTime") })}</span>
        <span aria-hidden>·</span>
        <span>{t("sourceCount", { count: snapshot.counts.sources })}</span>
        <span aria-hidden>·</span>
        <label className="inline-flex items-center gap-1.5">
          <span className="sr-only">{t("version", { version: snapshot.version })}</span>
          <select
            className="h-7 rounded-md border border-line bg-surface px-1.5 text-[12.5px] text-ink"
            value={snapshot.id}
            onChange={(e) => router.push(`/profiles/${profile.id}${e.target.value === profile.latestSnapshotId ? "" : `?snapshot=${e.target.value}`}`)}
          >
            {view.snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {t("version", { version: s.version })}
                {s.id === profile.latestSnapshotId ? ` (${t("latest")})` : ""} — {fmtDate(s.researchedAt, "dateShort")}
              </option>
            ))}
          </select>
        </label>
        {view.snapshots.length > 1 ? (
          <Link href={`/profiles/${profile.id}/changes${snapshotParam ? `?to=${snapshot.id}` : ""}`} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            <GitCompareArrows className="h-3.5 w-3.5" aria-hidden />
            {t("whatChanged")}
          </Link>
        ) : null}
        <span className="basis-full text-xs text-subtle sm:basis-auto">{t("identityMethod", { reason: identityReason(snapshot.identity.resolution, (k, v) => tMethods(k as never, v as never)) })}</span>
      </div>

      {error ? <Callout tone="danger">{error}</Callout> : null}
      {!isLatest ? (
        <Callout tone="info" action={<Link className="text-sm font-medium text-accent hover:underline" href={`/profiles/${profile.id}`}>{t("viewLatest")}</Link>}>
          {t("olderSnapshot")}
        </Callout>
      ) : null}
      {snapshot.status === "partial" ? <Callout tone="warn">{t("partialBanner")}</Callout> : null}
    </div>
  );
}
