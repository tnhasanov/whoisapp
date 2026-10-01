"use client";

import { AtSign, Building2, ExternalLink, Globe, Headset, Link2, Mail, Phone, PhoneCall, Smartphone, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEvidence } from "@/components/evidence/evidence-context";
import { Badge } from "@/components/ui/badge";
import { Card, SectionHeading } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import type { AccountView, ContactView } from "@/lib/data/profiles";
import type { ContactType } from "@/lib/domain/types";
import { displayHost, sourceHref } from "@/lib/source-links";
import { useDateFormat } from "@/lib/i18n/use-date-format";

const CONTACT_ICONS: Record<ContactType, typeof Mail> = {
  work_email: Mail,
  business_mobile: Smartphone,
  office_line: Phone,
  assistant: Headset,
  switchboard: Building2,
  press_office: AtSign,
  contact_page: Link2,
};

function ContactRow({ contact }: { contact: ContactView }) {
  const { open, view } = useEvidence();
  const t = useTranslations("Contacts");
  const fmtDate = useDateFormat();
  const Icon = CONTACT_ICONS[contact.contactType];
  const source = view.sources.find((s) => s.id === contact.sourceId);
  const isLink = contact.contactType === "contact_page";
  const href = contact.contactType === "work_email" || (contact.contactType === "press_office" && contact.value.includes("@")) ? `mailto:${contact.value}` : !isLink ? `tel:${contact.normalisedValue ?? contact.value}` : null;
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${contact.isDirect ? "bg-ok-soft text-ok" : "bg-slate-soft text-muted"}`} aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{t(`types.${contact.contactType}`)}</p>
          {isLink ? (
            source?.fixtureKey ? (
              <p className="font-mono text-[14px] text-ink break-anywhere">{contact.value}</p>
            ) : (
              <a href={contact.value} target="_blank" rel="noopener noreferrer nofollow" className="font-mono text-[14px] text-accent hover:underline break-anywhere">
                {contact.value}
              </a>
            )
          ) : view.profile.workspace === "demo" ? (
            <p className="font-mono text-[15px] text-ink break-anywhere">{contact.value}</p>
          ) : (
            <a href={href ?? undefined} className="font-mono text-[15px] text-ink hover:text-accent break-anywhere">
              {contact.value}
            </a>
          )}
          <p className="mt-1 text-[13px] text-ink-2">{contact.ownerLabel}</p>
          {contact.purpose ? <p className="text-[12.5px] text-muted">{contact.purpose}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={contact.isDirect ? "ok" : contact.belongsTo === "organisation" ? "warn" : "neutral"}>{t(`owner.${contact.belongsTo}`)}</Badge>
            <Badge tone="outline">{t("lastChecked", { date: fmtDate(contact.lastCheckedAt, "date") })}</Badge>
          </div>
        </div>
      </div>
      <button type="button" onClick={() => open({ kind: "contact", id: contact.id })} className="shrink-0 self-start rounded-md px-2 py-1 text-[12.5px] font-medium text-accent hover:bg-accent-soft">
        {t("publishedOn", { source: source?.publisher ?? (source ? displayHost(source.url) : "—") })}
      </button>
    </li>
  );
}

function isFictionalUrl(url: string): boolean {
  try {
    return /(^|\.)example(\.com|\.org|\.net)?$/i.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

function AccountRow({ account }: { account: AccountView }) {
  const { open } = useEvidence();
  const t = useTranslations("Accounts");
  const link = sourceHref({ url: account.url, fixtureKey: null });
  const isFictional = isFictionalUrl(account.url);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${account.status === "accepted" ? "bg-accent-soft text-accent-ink" : "bg-slate-soft text-muted"}`} aria-hidden>
          {account.platform === "website" ? <Globe className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{t(`platforms.${account.platform}`)}</p>
          <p className="text-[15px] font-medium text-ink break-anywhere">{account.handle ?? displayHost(account.url)}</p>
          {isFictional ? (
            <p className="font-mono text-[12px] text-muted break-anywhere">{account.url}</p>
          ) : (
            <a href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-mono text-[12px] text-accent hover:underline break-anywhere">
              {account.url}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          )}
          {account.description ? <p className="mt-1 text-[13px] text-ink-2">{account.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={account.status === "accepted" ? "ok" : "warn"}>{t(`discovery.${account.discovery}`)}</Badge>
            {account.accessNote ? <Badge tone="outline">{t("notAccessed")}</Badge> : null}
          </div>
        </div>
      </div>
      <button type="button" onClick={() => open({ kind: "account", id: account.id })} className="shrink-0 self-start rounded-md px-2 py-1 text-[12.5px] font-medium text-accent hover:bg-accent-soft">
        {t("matchEvidence")}
      </button>
    </li>
  );
}

export function ContactsTab() {
  const { view } = useEvidence();
  const t = useTranslations("Contacts");
  const tA = useTranslations("Accounts");
  const accepted = view.accounts.filter((a) => a.status === "accepted");
  const possible = view.accounts.filter((a) => a.status === "possible");
  const direct = view.contacts.filter((c) => c.belongsTo !== "organisation");
  const organisation = view.contacts.filter((c) => c.belongsTo === "organisation");
  return (
    <div className="space-y-10">
      <section aria-labelledby="contacts-heading">
        <SectionHeading id="contacts-heading" title={t("title")} description={t("hint")} />
        {view.contacts.length === 0 ? (
          <EmptyState icon={<PhoneCall className="h-6 w-6" aria-hidden />} title={t("empty")} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="border-b border-line px-4 py-2.5 label-caps">{t("owner.person")}</h3>
              {direct.length ? (
                <ul className="divide-y divide-line">
                  {direct.map((c) => (
                    <ContactRow key={c.id} contact={c} />
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-sm text-muted">{t("empty")}</p>
              )}
            </Card>
            <Card>
              <h3 className="border-b border-line px-4 py-2.5 label-caps">{t("owner.organisation")}</h3>
              {organisation.length ? (
                <ul className="divide-y divide-line">
                  {organisation.map((c) => (
                    <ContactRow key={c.id} contact={c} />
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-sm text-muted">—</p>
              )}
            </Card>
          </div>
        )}
      </section>

      <section aria-labelledby="accounts-heading">
        <SectionHeading id="accounts-heading" title={tA("title")} description={tA("hint")} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="border-b border-line px-4 py-2.5 label-caps">{tA("accepted")}</h3>
            {accepted.length ? (
              <ul className="divide-y divide-line">
                {accepted.map((a) => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted">{tA("acceptedEmpty")}</p>
            )}
          </Card>
          <Card className="border-dashed">
            <div className="border-b border-line px-4 py-2.5">
              <h3 className="label-caps">{tA("possible")}</h3>
              <p className="mt-0.5 text-xs text-muted">{tA("possibleHint")}</p>
            </div>
            {possible.length ? (
              <ul className="divide-y divide-line">
                {possible.map((a) => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted">{tA("possibleEmpty")}</p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
