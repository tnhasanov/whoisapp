import { useLocalSearchParams } from "expo-router";
import { DemoSourceView } from "@/components/brief/demo-source";
import { Screen } from "@/components/ui/screen";

/** Fictional demo source viewer (opened from identity candidates). */
export default function FixtureSourceScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  return (
    <Screen>
      <DemoSourceView fixtureKey={key} />
    </Screen>
  );
}
