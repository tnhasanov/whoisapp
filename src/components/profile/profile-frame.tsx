import type { ReactNode } from "react";
import { Suspense } from "react";
import { PageContainer } from "@/components/app-shell/app-shell";
import { EvidenceProvider } from "@/components/evidence/evidence-context";
import type { ProfileView } from "@/lib/data/profiles";
import { ProfileHeader } from "./profile-header";
import { ProfileTabs } from "./profile-tabs";

export function ProfileFrame({ view, children }: { view: ProfileView; children: ReactNode }) {
  return (
    <EvidenceProvider view={view}>
      <PageContainer wide>
        <ProfileHeader />
        <div className="mt-4">
          <Suspense>
            <ProfileTabs profileId={view.profile.id} />
          </Suspense>
        </div>
        <div className="pt-6">{children}</div>
      </PageContainer>
    </EvidenceProvider>
  );
}
