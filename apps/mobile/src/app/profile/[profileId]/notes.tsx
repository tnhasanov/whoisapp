import { useLocalSearchParams } from "expo-router";
import { Pencil, Plus, Tag as TagIcon, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { NOTE_MAX_LENGTH, TAG_MAX_LENGTH } from "@personbrief/shared/api/v1";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, Divider } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Chip, SectionHeader } from "@/components/ui/list";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState, OfflineBanner, useErrorText, useOnline } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { haptics } from "@/lib/actions";
import { useDates } from "@/lib/i18n";
import { useAddNote, useAddTag, useDeleteNote, useEditNote, useProfile, useRemoveTag } from "@/lib/queries";
import { RADIUS, SPACE, TOUCH, useColors } from "@/lib/theme";

/** G. Private notes and tags — kept apart from sourced facts, shared with the website. */
export default function NotesScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const t = useTranslations("Profile");
  const tApp = useTranslations("App.notes");
  const tCommon = useTranslations("Common");
  const colors = useColors();
  const dates = useDates();
  const online = useOnline();
  const errorText = useErrorText();
  const query = useProfile(profileId);
  const addNote = useAddNote(profileId);
  const editNote = useEditNote(profileId);
  const deleteNote = useDeleteNote(profileId);
  const addTag = useAddTag(profileId);
  const removeTag = useRemoveTag(profileId);
  const [draft, setDraft] = useState("");
  const [tag, setTag] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);

  if (query.isPending) return <LoadingState />;
  if (!query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const profile = query.data;
  const mutationError = [addNote.error, editNote.error, deleteNote.error, addTag.error, removeTag.error].find(Boolean);
  const suggestions = profile.availableTags.filter((a) => !profile.tags.some((x) => x.id === a.id) && (!tag || a.name.toLowerCase().includes(tag.toLowerCase())));

  const submitTag = (name: string) => {
    const value = name.trim();
    if (!value) return;
    addTag.mutate(value, { onSuccess: () => setTag("") });
  };

  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <OfflineBanner />
      <Text variant="title">{profile.profile.displayName}</Text>
      <Banner tone="info" body={t("notesHint")} />
      {mutationError ? <Banner tone="danger" body={errorText(mutationError).body} /> : null}

      <SectionHeader title={t("tags")} />
      <Card style={styles.gap}>
        {profile.tags.length === 0 ? (
          <Text variant="footnote" tone="muted">
            {tApp("noTags")}
          </Text>
        ) : (
          <View style={styles.tags}>
            {profile.tags.map((x) => (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityLabel={t("removeTag", { name: x.name })}
                disabled={!online || removeTag.isPending}
                onPress={() => removeTag.mutate(x.id)}
                style={[styles.tag, { backgroundColor: colors["accent-soft"] }]}
              >
                <TagIcon size={13} color={colors["accent-ink"]} />
                <Text variant="subhead" tone="accent-ink">
                  {x.name}
                </Text>
                <X size={14} color={colors["accent-ink"]} />
              </Pressable>
            ))}
          </View>
        )}
        <Field label={t("addTag")} placeholder={t("tagPlaceholder")} value={tag} onChangeText={setTag} maxLength={TAG_MAX_LENGTH} returnKeyType="done" onSubmitEditing={() => submitTag(tag)} />
        {suggestions.length > 0 ? (
          <View style={styles.tags}>
            {suggestions.slice(0, 12).map((s) => (
              <Chip key={s.id} label={`#${s.name}`} onPress={() => submitTag(s.name)} />
            ))}
          </View>
        ) : null}
        <Button size="sm" variant="secondary" label={t("addTag")} icon={<Plus size={16} color={colors.ink} />} disabled={!tag.trim() || !online} loading={addTag.isPending} onPress={() => submitTag(tag)} />
      </Card>

      <SectionHeader title={t("notes")} />
      <Card style={styles.gap}>
        <Field label={tApp("newNote")} placeholder={t("notePlaceholder")} value={draft} onChangeText={setDraft} multiline maxLength={NOTE_MAX_LENGTH} />
        <Button
          size="sm"
          label={t("addNote")}
          disabled={!draft.trim() || !online}
          loading={addNote.isPending}
          onPress={() =>
            addNote.mutate(draft, {
              onSuccess: () => {
                haptics.success();
                setDraft("");
              },
            })
          }
        />
      </Card>

      {profile.notes.length === 0 ? (
        <Text variant="footnote" tone="muted" style={styles.empty}>
          {t("noNotes")}
        </Text>
      ) : (
        <Card padded={false}>
          {profile.notes.map((n, i) => (
            <View key={n.id}>
              {i > 0 ? <Divider /> : null}
              {editing?.id === n.id ? (
                <View style={[styles.note, styles.gap]}>
                  <Field label={tCommon("edit")} value={editing.body} onChangeText={(body) => setEditing({ id: n.id, body })} multiline maxLength={NOTE_MAX_LENGTH} autoFocus />
                  <View style={styles.row}>
                    <Button size="sm" variant="ghost" label={tCommon("cancel")} onPress={() => setEditing(null)} />
                    <Button
                      size="sm"
                      label={tCommon("save")}
                      disabled={!editing.body.trim() || !online}
                      loading={editNote.isPending}
                      onPress={() => editNote.mutate({ noteId: n.id, body: editing.body }, { onSuccess: () => setEditing(null) })}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.note}>
                  <Text variant="callout" selectable>
                    {n.body}
                  </Text>
                  <View style={styles.row}>
                    <Text variant="caption" tone="muted" style={styles.flex}>
                      {dates.dateTime(n.updatedAt, "dateTime")}
                    </Text>
                    <IconButton label={tCommon("edit")} onPress={() => setEditing({ id: n.id, body: n.body })} icon={<Pencil size={17} color={colors.accent} />} />
                    <IconButton
                      label={tCommon("delete")}
                      onPress={() =>
                        Alert.alert(tApp("deleteTitle"), tApp("deleteBody"), [
                          { text: tCommon("cancel"), style: "cancel" },
                          { text: tCommon("delete"), style: "destructive", onPress: () => deleteNote.mutate(n.id) },
                        ])
                      }
                      icon={<Trash2 size={17} color={colors.danger} />}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function IconButton({ label, onPress, icon }: { label: string; onPress: () => void; icon: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={styles.iconButton}>
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gap: { gap: SPACE.md },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: RADIUS.pill },
  note: { padding: SPACE.lg, gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, justifyContent: "flex-end" },
  flex: { flex: 1 },
  empty: { paddingHorizontal: SPACE.xs },
  iconButton: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
});
