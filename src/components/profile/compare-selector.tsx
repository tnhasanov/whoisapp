"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Label, Select } from "@/components/ui/field";

export function CompareSelector({ profileId, snapshots, fromId, toId }: { profileId: string; snapshots: { id: string; version: number; label: string }[]; fromId: string; toId: string }) {
  const t = useTranslations("Changes");
  const tP = useTranslations("Profile");
  const router = useRouter();
  const go = (from: string, to: string) => router.push(`/profiles/${profileId}/changes?from=${from}&to=${to}`);
  const toVersion = snapshots.find((s) => s.id === toId)?.version ?? 0;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="cmp-from">{t("compare")}</Label>
        <Select id="cmp-from" value={fromId} onChange={(e) => go(e.target.value, toId)}>
          {snapshots
            .filter((s) => s.version < toVersion)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {tP("version", { version: s.version })} — {s.label}
              </option>
            ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cmp-to">{t("with")}</Label>
        <Select id="cmp-to" value={toId} onChange={(e) => go(fromId, e.target.value)}>
          {snapshots
            .filter((s) => s.version > 1)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {tP("version", { version: s.version })} — {s.label}
              </option>
            ))}
        </Select>
      </div>
    </div>
  );
}
