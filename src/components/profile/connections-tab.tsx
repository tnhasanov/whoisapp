"use client";

import { Building2, List, Network, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type KeyboardEvent } from "react";
import { useEvidence } from "@/components/evidence/evidence-context";
import { CitationMarkers } from "@/components/evidence/evidence-trigger";
import { Badge } from "@/components/ui/badge";
import { Card, SectionHeading } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { formatPartialDate } from "@/lib/dates/partial-date";
import type { RelationshipView } from "@/lib/data/profiles";
import type { RelationshipType } from "@/lib/domain/types";
import { initials } from "@/lib/names";
import { cn } from "@/lib/utils";

function RelationshipRow({ r }: { r: RelationshipView }) {
  const t = useTranslations("Connections");
  const locale = useLocale();
  const dates = [formatPartialDate(r.start, locale), formatPartialDate(r.end, locale)].filter(Boolean).join(" – ");
  return (
    <li className="flex gap-3 p-4">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold", r.kind === "documented" ? "bg-accent-soft text-accent-ink" : "bg-slate-soft text-muted")} aria-hidden>
        {initials(r.counterpartName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-medium text-ink">
          {r.counterpartName}
          <CitationMarkers target={{ kind: "relationship", id: r.id }} sourceIds={r.evidence.map((e) => e.sourceId)} label={`${r.counterpartName} — ${r.label}`} />
        </p>
        {r.counterpartRole ? <p className="text-[13px] text-muted">{r.counterpartRole}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2">
          <Badge tone={r.kind === "documented" ? "accent" : "outline"}>{t(`types.${r.relationType}`)}</Badge>
          {r.organisationName ? <span>{t("at", { organisation: r.organisationName })}</span> : null}
          {r.project ? <span>· {t("on", { project: r.project })}</span> : null}
          {dates ? <span className="text-muted tabular">· {dates}</span> : null}
        </div>
        {r.note ? <p className="mt-1.5 text-xs text-muted">{r.note}</p> : null}
      </div>
    </li>
  );
}

type GraphNode = { id: string; kind: "subject" | "person" | "org"; label: string; x: number; y: number; targetKind?: "relationship" | "organisation"; targetId?: string; aria: string };
type GraphEdge = { id: string; from: string; to: string; documented: boolean; label: string; relationshipId: string | null };

function layoutGraph(subjectName: string, rels: RelationshipView[], orgIdFor: (r: RelationshipView) => string | null, orgName: (id: string) => string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const W = 840;
  const H = 540;
  const cx = W / 2;
  const cy = H / 2;
  const nodes: GraphNode[] = [{ id: "subject", kind: "subject", label: subjectName, x: cx, y: cy, aria: subjectName }];
  const edges: GraphEdge[] = [];
  const documented = rels.filter((r) => r.kind === "documented");
  const shared = rels.filter((r) => r.kind === "shared_affiliation");

  // Documented people on the upper arc.
  documented.forEach((r, i) => {
    const angle = Math.PI + (Math.PI * (i + 1)) / (documented.length + 1);
    const id = `p:${r.id}`;
    nodes.push({ id, kind: "person", label: r.counterpartName, x: cx + Math.cos(angle) * 300, y: cy + Math.sin(angle) * 190, targetKind: "relationship", targetId: r.id, aria: `${r.counterpartName}, ${r.label}` });
    edges.push({ id: `e:${r.id}`, from: "subject", to: id, documented: true, label: r.label, relationshipId: r.id });
  });

  // Shared affiliations: organisation nodes on the lower arc, people beyond them.
  const orgIds = [...new Set(shared.map((r) => orgIdFor(r)).filter((x): x is string => Boolean(x)))];
  orgIds.forEach((orgId, i) => {
    const angle = (Math.PI * (i + 1)) / (orgIds.length + 1);
    const ox = cx + Math.cos(angle) * 230;
    const oy = cy + Math.sin(angle) * 130;
    const nodeId = `o:${orgId}`;
    nodes.push({ id: nodeId, kind: "org", label: orgName(orgId), x: ox, y: oy, targetKind: "organisation", targetId: orgId, aria: orgName(orgId) });
    edges.push({ id: `eo:${orgId}`, from: "subject", to: nodeId, documented: false, label: "", relationshipId: null });
    const members = shared.filter((r) => orgIdFor(r) === orgId);
    members.forEach((r, j) => {
      const spread = (j - (members.length - 1) / 2) * 0.55;
      const px = ox + Math.cos(angle + spread) * 150;
      const py = Math.min(H - 30, oy + Math.sin(angle + spread) * 110 + 20);
      const pid = `sp:${r.id}`;
      nodes.push({ id: pid, kind: "person", label: r.counterpartName, x: px, y: py, targetKind: "relationship", targetId: r.id, aria: `${r.counterpartName}, ${r.label}` });
      edges.push({ id: `es:${r.id}`, from: nodeId, to: pid, documented: false, label: r.label, relationshipId: r.id });
    });
  });
  return { nodes, edges };
}

function clipLabel(s: string, n = 22) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function ConnectionsGraph({ rels }: { rels: RelationshipView[] }) {
  const { view, open } = useEvidence();
  const t = useTranslations("Connections");
  const orgIdFor = (r: RelationshipView) => r.organisationId ?? (r.organisationName ? `name:${r.organisationName}` : null);
  const orgName = (id: string) => (id.startsWith("name:") ? id.slice(5) : (view.organisations.find((o) => o.id === id)?.name ?? "—"));
  const { nodes, edges } = useMemo(() => layoutGraph(view.profile.displayName, rels, orgIdFor, orgName), [rels, view.profile.displayName]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const activate = (n: GraphNode) => {
    if (n.targetKind === "relationship" && n.targetId) open({ kind: "relationship", id: n.targetId });
    if (n.targetKind === "organisation" && n.targetId && !n.targetId.startsWith("name:")) open({ kind: "organisation", id: n.targetId });
  };
  const onKey = (e: KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div>
      <svg viewBox="0 0 840 540" className="h-auto w-full" role="group" aria-label={t("graphHint")}>
        {edges.map((e) => {
          const a = byId.get(e.from)!;
          const b = byId.get(e.to)!;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <g key={e.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={e.documented ? "stroke-accent" : "stroke-line-strong"} strokeWidth={e.documented ? 2 : 1.5} strokeDasharray={e.documented ? undefined : "5 5"} />
              {e.label && e.relationshipId ? (
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`${e.label}: ${b.label}`}
                  className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-focus [&:focus-visible>rect]:stroke-2"
                  onClick={() => open({ kind: "relationship", id: e.relationshipId! })}
                  onKeyDown={(ev) => onKey(ev, () => open({ kind: "relationship", id: e.relationshipId! }))}
                >
                  <rect x={mx - 52} y={my - 10} width={104} height={20} rx={10} className={e.documented ? "fill-accent-soft stroke-accent/40" : "fill-surface stroke-line"} />
                  <text x={mx} y={my + 4} textAnchor="middle" className={cn("text-[10.5px] font-medium", e.documented ? "fill-accent-ink" : "fill-muted")}>
                    {clipLabel(e.label, 18)}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
        {nodes.map((n) => {
          const interactive = Boolean(n.targetKind && n.targetId && !(n.targetKind === "organisation" && n.targetId.startsWith("name:")));
          const common = interactive
            ? {
                role: "button" as const,
                tabIndex: 0,
                "aria-label": n.aria,
                onClick: () => activate(n),
                onKeyDown: (e: KeyboardEvent) => onKey(e, () => activate(n)),
                className: "cursor-pointer outline-none [&:focus-visible>*:first-child]:stroke-focus [&:focus-visible>*:first-child]:stroke-[3]",
              }
            : { "aria-label": n.aria };
          if (n.kind === "org") {
            return (
              <g key={n.id} {...common}>
                <rect x={n.x - 70} y={n.y - 18} width={140} height={36} rx={6} className="fill-surface-2 stroke-line-strong" strokeWidth={1.5} />
                <text x={n.x} y={n.y + 4} textAnchor="middle" className="fill-ink text-[11.5px] font-medium">
                  {clipLabel(n.label)}
                </text>
              </g>
            );
          }
          const subject = n.kind === "subject";
          return (
            <g key={n.id} {...common}>
              <circle cx={n.x} cy={n.y} r={subject ? 34 : 24} className={subject ? "fill-ink stroke-ink" : "fill-surface stroke-accent"} strokeWidth={subject ? 0 : 1.5} />
              <text x={n.x} y={n.y + (subject ? 5 : 4)} textAnchor="middle" className={cn("font-semibold", subject ? "fill-canvas text-[14px]" : "fill-accent-ink text-[11.5px]")}>
                {initials(n.label)}
              </text>
              <text x={n.x} y={n.y + (subject ? 52 : 40)} textAnchor="middle" className="fill-ink-2 text-[11.5px]">
                {clipLabel(n.label)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          {t("graphLegendPerson")}
        </li>
        <li className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" aria-hidden />
          {t("graphLegendOrg")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-accent" aria-hidden />
          {t("graphLegendDocumented")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-dashed border-line-strong" aria-hidden />
          {t("graphLegendShared")}
        </li>
      </ul>
    </div>
  );
}

export function ConnectionsTab() {
  const { view } = useEvidence();
  const t = useTranslations("Connections");
  const [mode, setMode] = useState<"list" | "graph">("list");
  const presentTypes = [...new Set(view.relationships.map((r) => r.relationType))];
  const [hidden, setHidden] = useState<Set<RelationshipType>>(new Set());
  const visible = view.relationships.filter((r) => !hidden.has(r.relationType));
  const documented = visible.filter((r) => r.kind === "documented");
  const shared = visible.filter((r) => r.kind === "shared_affiliation");

  if (view.relationships.length === 0) {
    return (
      <div className="space-y-4">
        <SectionHeading title={t("title")} description={t("hint")} />
        <EmptyState icon={<Network className="h-6 w-6" aria-hidden />} title={t("documentedEmpty")} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title={t("title")}
        description={t("hint")}
        action={
          <div role="radiogroup" aria-label={t("title")} className="grid grid-cols-2 rounded-md border border-line bg-sunken p-0.5">
            {(["list", "graph"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn("flex h-8 items-center justify-center gap-1.5 rounded-[5px] px-3 text-[12.5px] font-medium", mode === m ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink")}
              >
                {m === "list" ? <List className="h-3.5 w-3.5" aria-hidden /> : <Network className="h-3.5 w-3.5" aria-hidden />}
                {m === "list" ? t("listView") : t("graphView")}
              </button>
            ))}
          </div>
        }
      />

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">{t("filters")}</legend>
        {presentTypes.map((type) => {
          const on = !hidden.has(type);
          return (
            <label key={type} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px]", on ? "border-accent/40 bg-accent-soft text-accent-ink" : "border-line text-muted")}>
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(type)) next.delete(type);
                    else next.add(type);
                    return next;
                  })
                }
              />
              <span aria-hidden>{on ? "✓" : "+"}</span>
              {t(`types.${type}`)}
            </label>
          );
        })}
      </fieldset>

      {mode === "graph" ? (
        <Card className="p-4 sm:p-6">
          <p className="mb-2 text-xs text-muted">{t("graphHint")}</p>
          <ConnectionsGraph rels={visible} />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="documented-heading">
            <h3 id="documented-heading" className="mb-2 label-caps">
              {t("documented")}
            </h3>
            <Card>
              {documented.length ? (
                <ul className="divide-y divide-line">
                  {documented.map((r) => (
                    <RelationshipRow key={r.id} r={r} />
                  ))}
                </ul>
              ) : (
                <p className="p-4 text-sm text-muted">{t("documentedEmpty")}</p>
              )}
            </Card>
          </section>
          <section aria-labelledby="shared-heading">
            <h3 id="shared-heading" className="mb-1 label-caps">
              {t("shared")}
            </h3>
            <p className="mb-2 text-xs text-muted">{t("sharedHint")}</p>
            <Card className="border-dashed">
              {shared.length ? (
                <ul className="divide-y divide-line">
                  {shared.map((r) => (
                    <RelationshipRow key={r.id} r={r} />
                  ))}
                </ul>
              ) : (
                <p className="p-4 text-sm text-muted">{t("sharedEmpty")}</p>
              )}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
