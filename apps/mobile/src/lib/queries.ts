import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ChangesResponseSchema,
  DemoSourceSchema,
  DeviceResponseSchema,
  ExamplesResponseSchema,
  JobDetailSchema,
  JobListResponseSchema,
  JobReferenceResponseSchema,
  MeResponseSchema,
  NoteSchema,
  ProfileDetailSchema,
  ProfileListResponseSchema,
  ProfileTagsResponseSchema,
  RecentSearchesResponseSchema,
  RefineResponseSchema,
  RevokeOthersResponseSchema,
  SavedStateSchema,
  SessionListResponseSchema,
  SettingsResponseSchema,
  StartResearchResponseSchema,
  TagListResponseSchema,
  type JobDetail,
  type MeResponse,
  type ProfileDetail,
} from "@personbrief/shared/api/v1";
import type { SearchInput } from "@personbrief/shared/research/search-input";
import type { IssueCategory, Locale, Workspace } from "@personbrief/shared/domain";
import { request } from "./api";
import { useSession } from "./session";

/**
 * Server state for every screen. Keys start with the signed-in user's id so
 * one account's cached data can never appear for another; the whole cache is
 * cleared on sign-in and sign-out anyway.
 */

export const keys = {
  me: (u: string) => ["u", u, "me"] as const,
  settings: (u: string) => ["u", u, "settings"] as const,
  sessions: (u: string) => ["u", u, "sessions"] as const,
  device: (u: string) => ["u", u, "device"] as const,
  jobs: (u: string, ws: string, status: string) => ["u", u, ws, "jobs", status] as const,
  jobsAll: (u: string) => ["u", u] as const,
  job: (u: string, id: string) => ["u", u, "job", id] as const,
  recent: (u: string, ws: string) => ["u", u, ws, "recent"] as const,
  examples: (u: string) => ["u", u, "examples"] as const,
  profiles: (u: string, ws: string, q: ProfileFilters) => ["u", u, ws, "profiles", q] as const,
  profilesAll: (u: string) => ["u", u] as const,
  profile: (u: string, id: string, snapshot: string | null) => ["u", u, "profile", id, snapshot ?? "latest"] as const,
  profileAny: (u: string, id: string) => ["u", u, "profile", id] as const,
  changes: (u: string, id: string, from: string | null, to: string | null) => ["u", u, "changes", id, from, to] as const,
  tags: (u: string, ws: string) => ["u", u, ws, "tags"] as const,
  demoSource: (u: string, key: string) => ["u", u, "demo-source", key] as const,
};

function useIds() {
  const session = useSession();
  const userId = session.state.status === "signedIn" ? session.state.userId : "anonymous";
  const me = useQuery({ queryKey: keys.me(userId), queryFn: () => request("/me", { schema: MeResponseSchema }), enabled: userId !== "anonymous" });
  return { userId, workspace: me.data?.workspace ?? "live", me };
}

/* --------------------------------- Account -------------------------------- */

export function useMe() {
  return useIds().me;
}

export function useSettings() {
  const { userId } = useIds();
  return useQuery({ queryKey: keys.settings(userId), queryFn: () => request("/settings", { schema: SettingsResponseSchema }) });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (prefs: { locale?: Locale; timezone?: string }) => request("/me/preferences", { method: "PATCH", body: prefs, schema: MeResponseSchema }),
    onSuccess: (me) => qc.setQueryData(keys.me(userId), me),
  });
}

export function useSetWorkspace() {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (workspace: Workspace) => request("/me/workspace", { method: "PUT", body: { workspace }, schema: MeResponseSchema }),
    onSuccess: (me) => {
      qc.setQueryData(keys.me(userId), me);
      // Lists are per workspace; drop everything else for a clean switch.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] === "u" && q.queryKey[1] === userId && q.queryKey[2] !== "me" });
    },
  });
}

export function useSessions() {
  const { userId } = useIds();
  return useQuery({ queryKey: keys.sessions(userId), queryFn: () => request("/sessions", { schema: SessionListResponseSchema }) });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (sessionId: string) => request(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions(userId) }),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: () => request("/sessions", { method: "DELETE", query: { scope: "others" }, schema: RevokeOthersResponseSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sessions(userId) }),
  });
}

export function useDeviceRegistration(enabled = true) {
  const { userId } = useIds();
  return useQuery({ queryKey: keys.device(userId), queryFn: () => request("/devices/current", { schema: DeviceResponseSchema }), enabled });
}

/* -------------------------------- Research -------------------------------- */

export function useRecentSearches() {
  const { userId, workspace } = useIds();
  return useQuery({ queryKey: keys.recent(userId, workspace), queryFn: () => request("/research/recent", { schema: RecentSearchesResponseSchema }) });
}

export function useExamples(enabled: boolean) {
  const { userId } = useIds();
  return useQuery({ queryKey: keys.examples(userId), queryFn: () => request("/examples", { schema: ExamplesResponseSchema }), enabled, staleTime: Infinity });
}

export function useJobs(status: "all" | "active" | "finished") {
  const { userId, workspace } = useIds();
  return useInfiniteQuery({
    queryKey: keys.jobs(userId, workspace, status),
    queryFn: ({ pageParam }) => request("/research", { query: { status, cursor: pageParam, limit: 25 }, schema: JobListResponseSchema }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** A research run, polled at the server's suggested pace while it is active (paused in the background). */
export function useJob(jobId: string) {
  const { userId } = useIds();
  return useQuery({
    queryKey: keys.job(userId, jobId),
    queryFn: () => request(`/research/${jobId}`, { schema: JobDetailSchema }),
    refetchInterval: (query) => query.state.data?.pollAfterMs ?? false,
    staleTime: 0,
  });
}

function afterJobChange(qc: QueryClient, userId: string, job?: JobDetail) {
  if (job) qc.setQueryData(keys.job(userId, job.id), job);
  void qc.invalidateQueries({ predicate: (q) => q.queryKey[1] === userId && (q.queryKey.includes("jobs") || q.queryKey.includes("recent")) });
}

export function useStartResearch() {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: SearchInput; idempotencyKey: string }) =>
      request("/research", { method: "POST", body: input, idempotencyKey, schema: StartResearchResponseSchema }),
    onSuccess: (result) => afterJobChange(qc, userId, result.job),
  });
}

export function useSelectCandidate(jobId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (candidateId: string) => request(`/research/${jobId}/select`, { method: "POST", body: { candidateId }, schema: JobDetailSchema }),
    onSuccess: (job) => afterJobChange(qc, userId, job),
  });
}

export function useRefine(jobId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: () => request(`/research/${jobId}/refine`, { method: "POST", schema: RefineResponseSchema }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.job(userId, jobId) });
      afterJobChange(qc, userId);
    },
  });
}

export function useCancelJob(jobId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: () => request(`/research/${jobId}/cancel`, { method: "POST", schema: JobDetailSchema }),
    onSuccess: (job) => afterJobChange(qc, userId, job),
  });
}

export function useRetryJob(jobId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (idempotencyKey: string) => request(`/research/${jobId}/retry`, { method: "POST", idempotencyKey, schema: JobReferenceResponseSchema }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.job(userId, jobId) });
      afterJobChange(qc, userId);
    },
  });
}

export function useReopenIdentity(jobId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (idempotencyKey: string) => request(`/research/${jobId}/reopen`, { method: "POST", idempotencyKey, schema: JobReferenceResponseSchema }),
    onSuccess: () => afterJobChange(qc, userId),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (jobId: string) => request(`/research/${jobId}`, { method: "DELETE" }),
    onSuccess: (_data, jobId) => {
      qc.removeQueries({ queryKey: keys.job(userId, jobId) });
      afterJobChange(qc, userId);
    },
  });
}

/* --------------------------------- Profiles -------------------------------- */

export type ProfileFilters = { scope: "saved" | "all"; q?: string; sort: "recent" | "name" | "researched"; tagId?: string; limit?: number };

export function useProfiles(query: ProfileFilters) {
  const { userId, workspace } = useIds();
  return useInfiniteQuery({
    queryKey: keys.profiles(userId, workspace, query),
    queryFn: ({ pageParam }) =>
      request("/profiles", {
        query: { scope: query.scope, q: query.q, sort: query.sort, tagId: query.tagId, limit: query.limit ?? 30, cursor: pageParam },
        schema: ProfileListResponseSchema,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useTags() {
  const { userId, workspace } = useIds();
  return useQuery({ queryKey: keys.tags(userId, workspace), queryFn: () => request("/tags", { schema: TagListResponseSchema }) });
}

export function useProfile(profileId: string, snapshotId: string | null = null) {
  const { userId } = useIds();
  return useQuery({
    queryKey: keys.profile(userId, profileId, snapshotId),
    queryFn: () => request(`/profiles/${profileId}`, { query: { snapshot: snapshotId }, schema: ProfileDetailSchema }),
  });
}

/** Read a brief already loaded by the brief screen (the evidence sheet never refetches). */
export function useCachedProfile(profileId: string, snapshotId: string | null) {
  return useProfile(profileId, snapshotId);
}

export function useChanges(profileId: string, from: string | null, to: string | null) {
  const { userId } = useIds();
  return useQuery({
    queryKey: keys.changes(userId, profileId, from, to),
    queryFn: () => request(`/profiles/${profileId}/changes`, { query: { from, to }, schema: ChangesResponseSchema }),
  });
}

function invalidateProfile(qc: QueryClient, userId: string, profileId: string) {
  void qc.invalidateQueries({ queryKey: keys.profileAny(userId, profileId) });
  void qc.invalidateQueries({ predicate: (q) => q.queryKey[1] === userId && (q.queryKey.includes("profiles") || q.queryKey.includes("tags")) });
}

function patchProfiles(qc: QueryClient, userId: string, profileId: string, patch: (p: ProfileDetail) => ProfileDetail) {
  qc.setQueriesData<ProfileDetail>({ queryKey: keys.profileAny(userId, profileId) }, (old) => (old ? patch(old) : old));
}

export function useSetSaved(profileId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (saved: boolean) => request(`/profiles/${profileId}/saved`, { method: "PUT", body: { saved }, schema: SavedStateSchema }),
    onSuccess: ({ savedAt }) => {
      patchProfiles(qc, userId, profileId, (p) => ({ ...p, profile: { ...p.profile, savedAt } }));
      invalidateProfile(qc, userId, profileId);
    },
  });
}

export function useAddNote(profileId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (body: string) => request(`/profiles/${profileId}/notes`, { method: "POST", body: { body }, schema: NoteSchema }),
    onSuccess: (note) => {
      patchProfiles(qc, userId, profileId, (p) => ({ ...p, notes: [note, ...p.notes] }));
      invalidateProfile(qc, userId, profileId);
    },
  });
}

export function useEditNote(profileId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: string }) => request(`/profiles/${profileId}/notes/${noteId}`, { method: "PATCH", body: { body }, schema: NoteSchema }),
    onSuccess: (note) => {
      patchProfiles(qc, userId, profileId, (p) => ({ ...p, notes: p.notes.map((n) => (n.id === note.id ? note : n)) }));
      invalidateProfile(qc, userId, profileId);
    },
  });
}

export function useDeleteNote(profileId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (noteId: string) => request(`/profiles/${profileId}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: (_d, noteId) => {
      patchProfiles(qc, userId, profileId, (p) => ({ ...p, notes: p.notes.filter((n) => n.id !== noteId) }));
      invalidateProfile(qc, userId, profileId);
    },
  });
}

export function useAddTag(profileId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (name: string) => request(`/profiles/${profileId}/tags`, { method: "POST", body: { name }, schema: ProfileTagsResponseSchema }),
    onSuccess: (state) => {
      patchProfiles(qc, userId, profileId, (p) => ({ ...p, tags: state.tags, availableTags: state.availableTags }));
      invalidateProfile(qc, userId, profileId);
    },
  });
}

export function useRemoveTag(profileId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (tagId: string) => request(`/profiles/${profileId}/tags/${tagId}`, { method: "DELETE", schema: ProfileTagsResponseSchema }),
    onSuccess: (state) => {
      patchProfiles(qc, userId, profileId, (p) => ({ ...p, tags: state.tags, availableTags: state.availableTags }));
      invalidateProfile(qc, userId, profileId);
    },
  });
}

export function useReportIssue(profileId: string) {
  return useMutation({
    mutationFn: (input: { category: IssueCategory; message: string; snapshotId?: string | null; claimId?: string | null }) =>
      request(`/profiles/${profileId}/issues`, { method: "POST", body: input, schema: z.object({ ok: z.literal(true) }) }),
  });
}

export function useRefreshProfile(profileId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: (idempotencyKey: string) => request(`/profiles/${profileId}/refresh`, { method: "POST", idempotencyKey, schema: JobReferenceResponseSchema }),
    onSuccess: () => afterJobChange(qc, userId),
  });
}

export function useDeleteProfile(profileId: string) {
  const qc = useQueryClient();
  const { userId } = useIds();
  return useMutation({
    mutationFn: () => request(`/profiles/${profileId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: keys.profileAny(userId, profileId) });
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[1] === userId && q.queryKey[2] !== "me" });
    },
  });
}

export function useDemoSource(key: string) {
  const { userId } = useIds();
  return useQuery({ queryKey: keys.demoSource(userId, key), queryFn: () => request(`/demo-sources/${encodeURIComponent(key)}`, { schema: DemoSourceSchema }), staleTime: Infinity });
}

export type { MeResponse };
