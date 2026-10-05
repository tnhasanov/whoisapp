import { Copy, ExternalLink, Globe, Mail, Phone } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { Account, Contact, ProfileDetail } from "@personbrief/shared/api/v1";
import { copyText, openDialer, openEmail, openExternal } from "@/lib/actions";
import { displayHost } from "@/lib/format";
import { useDates } from "@/lib/i18n";
import { SPACE, TOUCH, useColors } from "@/lib/theme";
import { Badge } from "../ui/badge";
import { Card, Divider } from "../ui/card";
import { Text } from "../ui/text";
import { Block, EmptyLine, useOpenEvidence } from "./common";

const PHONE_TYPES = new Set(["business_mobile", "office_line", "assistant", "switchboard"]);

/**
 * Contacts & accounts. Only routes intentionally published for business,
 * each labelled with whose route it is and where it was published; a
 * switchboard is never presented as a direct line. Calling or emailing opens
 * the dialer or mail app — nothing is placed or sent automatically.
 */
export function ContactsSection({ profile }: { profile: ProfileDetail }) {
  const t = useTranslations("Contacts");
  const tAccounts = useTranslations("Accounts");
  const accepted = profile.accounts.filter((a) => a.status === "accepted");
  const possible = profile.accounts.filter((a) => a.status !== "accepted");
  return (
    <View style={styles.wrap}>
      <Block title={t("title")} hint={t("hint")}>
        {profile.contacts.length === 0 ? (
          <EmptyLine text={t("empty")} />
        ) : (
          <Card padded={false}>
            {[...profile.contacts]
              .sort((a, b) => Number(b.isDirect) - Number(a.isDirect))
              .map((c, i) => (
                <View key={c.id}>
                  {i > 0 ? <Divider /> : null}
                  <ContactRow profile={profile} contact={c} />
                </View>
              ))}
          </Card>
        )}
      </Block>
      <Block title={tAccounts("accepted")} hint={tAccounts("hint")}>
        {accepted.length === 0 ? <EmptyLine text={tAccounts("acceptedEmpty")} /> : <AccountList profile={profile} accounts={accepted} />}
      </Block>
      <Block title={tAccounts("possible")} hint={tAccounts("possibleHint")}>
        {possible.length === 0 ? <EmptyLine text={tAccounts("possibleEmpty")} /> : <AccountList profile={profile} accounts={possible} />}
      </Block>
    </View>
  );
}

function ContactRow({ profile, contact: c }: { profile: ProfileDetail; contact: Contact }) {
  const t = useTranslations("Contacts");
  const tApp = useTranslations("App.contacts");
  const colors = useColors();
  const dates = useDates();
  const open = useOpenEvidence(profile);
  const source = profile.sources.find((s) => s.id === c.sourceId);
  const isPhone = PHONE_TYPES.has(c.contactType);
  const isEmail = c.contactType === "work_email";
  const isLink = c.contactType === "contact_page" || /^https?:\/\//i.test(c.value);
  const fictional = profile.profile.workspace === "demo";
  const typeLabel = t.has(`types.${c.contactType}`) ? t(`types.${c.contactType}`) : c.contactType;
  return (
    <View style={styles.contact}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${typeLabel}: ${c.value}. ${c.ownerLabel}`}
        accessibilityHint={tApp("evidenceHint")}
        onPress={() => open("contact", c.id)}
        style={styles.contactBody}
      >
        <View style={styles.badges}>
          <Badge tone="neutral" label={typeLabel} />
          <Badge tone={c.isDirect ? "ok" : "outline"} label={c.isDirect ? t("direct") : t("notDirect")} />
        </View>
        <Text variant="headline" selectable>
          {c.value}
        </Text>
        <Text variant="footnote" tone="ink-2">
          {c.ownerLabel}
          {c.purpose ? ` · ${c.purpose}` : ""}
        </Text>
        <Text variant="caption" tone="muted">
          {t("publishedOn", { source: source?.publisher ?? (source ? displayHost(source.url) : "—") })} · {t("lastChecked", { date: dates.dateTime(c.lastCheckedAt) })}
        </Text>
      </Pressable>
      <View style={styles.actions}>
        {isPhone ? (
          <ActionButton
            label={tApp("call")}
            icon={<Phone size={18} color={colors.accent} />}
            disabled={fictional}
            onPress={() => void openDialer(c.normalisedValue ?? c.value)}
          />
        ) : null}
        {isEmail ? (
          <ActionButton label={tApp("email")} icon={<Mail size={18} color={colors.accent} />} disabled={fictional} onPress={() => void openEmail(c.normalisedValue ?? c.value)} />
        ) : null}
        {isLink ? <ActionButton label={tApp("open")} icon={<Globe size={18} color={colors.accent} />} disabled={fictional} onPress={() => void openExternal(c.value)} /> : null}
        <ActionButton label={tApp("copy")} icon={<Copy size={18} color={colors.accent} />} onPress={() => void copyText(c.value)} />
      </View>
      {fictional ? (
        <Text variant="caption" tone="demo">
          {tApp("fictionalContact")}
        </Text>
      ) : null}
    </View>
  );
}

function ActionButton({ label, icon, onPress, disabled }: { label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { borderColor: colors.line, backgroundColor: pressed ? colors["accent-soft"] : colors["surface-2"], opacity: disabled ? 0.45 : 1 }]}
    >
      {icon}
      <Text variant="caption" tone="accent">
        {label}
      </Text>
    </Pressable>
  );
}

function AccountList({ profile, accounts }: { profile: ProfileDetail; accounts: Account[] }) {
  const tAccounts = useTranslations("Accounts");
  const colors = useColors();
  const open = useOpenEvidence(profile);
  const fictional = profile.profile.workspace === "demo";
  return (
    <Card padded={false}>
      {accounts.map((a, i) => {
        const platform = tAccounts.has(`platforms.${a.platform}`) ? tAccounts(`platforms.${a.platform}`) : a.platform;
        const discovery = tAccounts.has(`discovery.${a.discovery}`) ? tAccounts(`discovery.${a.discovery}`) : a.discovery;
        return (
          <View key={a.id}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.account}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${platform}: ${a.handle ?? a.url}`} onPress={() => open("account", a.id)} style={styles.flex}>
                <View style={styles.badges}>
                  <Badge tone="neutral" label={platform} />
                  <Badge tone={a.status === "accepted" ? "ok" : "warn"} label={a.status === "accepted" ? tAccounts("accepted") : tAccounts("possible")} />
                </View>
                <Text variant="bodyStrong" style={{ marginTop: 6 }}>
                  {a.handle ?? displayHost(a.url)}
                </Text>
                <Text variant="footnote" tone="muted">
                  {discovery}
                  {a.accessNote ? ` · ${a.accessNote}` : ""}
                </Text>
              </Pressable>
              {!fictional ? (
                <Pressable accessibilityRole="link" accessibilityLabel={`${platform}: ${a.url}`} hitSlop={8} onPress={() => void openExternal(a.url)} style={styles.iconButton}>
                  <ExternalLink size={18} color={colors.accent} />
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xxl },
  contact: { padding: SPACE.lg, gap: SPACE.md },
  contactBody: { gap: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  action: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, minWidth: TOUCH + 24, paddingHorizontal: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, justifyContent: "center" },
  account: { flexDirection: "row", alignItems: "center", padding: SPACE.lg, gap: SPACE.md },
  flex: { flex: 1 },
  iconButton: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
});
