import { ProfileFrame } from "@/components/profile/profile-frame";
import { NewsTab } from "@/components/profile/news-tab";
import { loadProfile } from "@/lib/data/profile-loader";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ profileId: string }>; searchParams: Promise<{ snapshot?: string }> };

export async function generateMetadata({ params, searchParams }: Props) {
  const { profileId } = await params;
  const { snapshot } = await searchParams;
  const { view } = await loadProfile(profileId, snapshot ?? null);
  return { title: view.profile.displayName };
}

export default async function Page({ params, searchParams }: Props) {
  const { profileId } = await params;
  const { snapshot } = await searchParams;
  const { view } = await loadProfile(profileId, snapshot ?? null);
  return (
    <ProfileFrame view={view}>
      <NewsTab />
    </ProfileFrame>
  );
}
