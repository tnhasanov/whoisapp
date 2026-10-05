import { useRouter } from "expo-router";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  const t = useTranslations("Common");
  const router = useRouter();
  return (
    <Screen>
      <EmptyState title={t("notFoundTitle")} body={t("notFoundBody")} action={<Button variant="secondary" label={t("goToSearch")} onPress={() => router.replace("/")} />} />
    </Screen>
  );
}
