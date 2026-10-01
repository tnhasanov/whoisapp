CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "candidate_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"rank" integer NOT NULL,
	"display_name" text NOT NULL,
	"native_name" text,
	"organisation" text,
	"role" text,
	"location" text,
	"summary" text,
	"match_strength" text NOT NULL,
	"match_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"distinguishing_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"anchor_key" text NOT NULL,
	"anchor_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"name_variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_selected" boolean DEFAULT false NOT NULL,
	"fixture_person_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_sources" (
	"claim_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"supporting_excerpt" text NOT NULL,
	"excerpt_language" text DEFAULT 'unknown' NOT NULL,
	"excerpt_verified" boolean NOT NULL,
	"stance" text DEFAULT 'supports' NOT NULL,
	CONSTRAINT "claim_sources_claim_id_source_id_pk" PRIMARY KEY("claim_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"claim_key" text NOT NULL,
	"category" text NOT NULL,
	"value" jsonb NOT NULL,
	"display_value" text NOT NULL,
	"evidence_status" text NOT NULL,
	"temporal" jsonb NOT NULL,
	"uncertainty_note" text,
	"conflict_group" text,
	"language" text DEFAULT 'unknown' NOT NULL,
	"original_text" text,
	"is_translated" boolean DEFAULT false NOT NULL,
	"accepted" boolean DEFAULT true NOT NULL,
	"rejection_reason" text,
	"sort_key" text
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"contact_type" text NOT NULL,
	"value" text NOT NULL,
	"normalised_value" text,
	"belongs_to" text NOT NULL,
	"owner_label" text NOT NULL,
	"purpose" text,
	"publication_context" text NOT NULL,
	"source_id" uuid NOT NULL,
	"supporting_excerpt" text NOT NULL,
	"last_checked_at" timestamp with time zone NOT NULL,
	"is_direct" boolean DEFAULT false NOT NULL,
	"contact_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"format" text NOT NULL,
	"include_notes" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"snapshot_id" uuid,
	"claim_id" uuid,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"source_key" text NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text,
	"publisher" text,
	"snippet" text,
	"content" text,
	"content_hash" text,
	"provider_published_at" text,
	"access_method" text NOT NULL,
	"access_status" text NOT NULL,
	"access_note" text,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fixture_key" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"stage" text,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"visibility" text DEFAULT 'user' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"name" text NOT NULL,
	"stage" text NOT NULL,
	"seq" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"output" jsonb,
	"reused" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"story_group_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"source_id" uuid,
	"headline" text NOT NULL,
	"outlet" text NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"kind" text NOT NULL,
	"published_at" text,
	"published_precision" text,
	"source_updated_at" text,
	"provider_reported_date" text,
	"event_date" jsonb,
	"discovered_at" timestamp with time zone NOT NULL,
	"language" text NOT NULL,
	"summary" text NOT NULL,
	"summary_basis" text NOT NULL,
	"involvement" text,
	"coverage_type" text NOT NULL,
	"topic" text NOT NULL,
	"match_evidence" text,
	"allegations" jsonb,
	"relevance_rank" integer NOT NULL,
	"media_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_story_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"story_key" text NOT NULL,
	"headline" text NOT NULL,
	"coverage_type" text NOT NULL,
	"topic" text NOT NULL,
	"first_published_at" text,
	"item_count" integer NOT NULL,
	"relevance_rank" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"normalised_name" text NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"timezone" text DEFAULT 'Asia/Baku' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"active_workspace" text DEFAULT 'live' NOT NULL,
	"research_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_tags" (
	"profile_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "profile_tags_profile_id_tag_id_pk" PRIMARY KEY("profile_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"workspace" text NOT NULL,
	"display_name" text NOT NULL,
	"native_name" text,
	"name_variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"headline_role" text,
	"headline_organisation" text,
	"headline_location" text,
	"anchor_key" text NOT NULL,
	"anchor_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latest_snapshot_id" uuid,
	"snapshot_count" integer DEFAULT 0 NOT NULL,
	"saved_at" timestamp with time zone,
	"last_researched_at" timestamp with time zone,
	"fixture_person_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"workspace" text NOT NULL,
	"job_id" uuid,
	"cache_key" text NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_sources" (
	"relationship_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"supporting_excerpt" text NOT NULL,
	"excerpt_verified" boolean NOT NULL,
	CONSTRAINT "relationship_sources_relationship_id_source_id_pk" PRIMARY KEY("relationship_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"relation_type" text NOT NULL,
	"label" text NOT NULL,
	"counterpart_name" text NOT NULL,
	"counterpart_role" text,
	"organisation_id" uuid,
	"organisation_name" text,
	"project" text,
	"start" jsonb,
	"end" jsonb,
	"note" text,
	"relationship_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"workspace" text NOT NULL,
	"kind" text DEFAULT 'search' NOT NULL,
	"parent_job_id" uuid,
	"profile_id" uuid,
	"snapshot_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"outcome" text,
	"phase" text DEFAULT 'discovery' NOT NULL,
	"current_stage" text,
	"query" jsonb NOT NULL,
	"query_key" text NOT NULL,
	"selected_candidate_id" uuid,
	"identity_resolution" jsonb,
	"idempotency_key" text NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"lease_owner" text,
	"lease_token" integer DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"config" jsonb NOT NULL,
	"usage" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"last_progress_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"workspace" text NOT NULL,
	"job_id" uuid,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"researched_at" timestamp with time zone NOT NULL,
	"identity" jsonb NOT NULL,
	"headline" jsonb NOT NULL,
	"overview" jsonb NOT NULL,
	"coverage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"access_limitations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_info" jsonb NOT NULL,
	"usage" jsonb,
	"counts" jsonb NOT NULL,
	"diagnostics" jsonb DEFAULT '{"rejected":[],"stats":{}}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"platform" text NOT NULL,
	"handle" text,
	"url" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"discovery" text NOT NULL,
	"match_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"access_note" text,
	"source_id" uuid,
	"account_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"source_key" text NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text,
	"publisher" text,
	"source_type" text NOT NULL,
	"reliability" text NOT NULL,
	"language" text DEFAULT 'unknown' NOT NULL,
	"published_at" text,
	"published_precision" text,
	"source_updated_at" text,
	"provider_reported_date" text,
	"accessed_at" timestamp with time zone NOT NULL,
	"access_method" text NOT NULL,
	"access_status" text NOT NULL,
	"access_note" text,
	"about_subject" text DEFAULT 'unclear' NOT NULL,
	"identity_evidence" text,
	"excerpt" text,
	"fixture_key" text
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"workspace" text NOT NULL,
	"name" text NOT NULL,
	"normalised_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"job_id" uuid,
	"workspace" text NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"model" text,
	"requests" integer DEFAULT 1 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"credits" numeric(12, 3) DEFAULT '0' NOT NULL,
	"estimated_cost_usd" numeric(12, 5) DEFAULT '0' NOT NULL,
	"cached" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'demo' NOT NULL,
	"is_anonymous" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"hostname" text,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"active_jobs" integer DEFAULT 0 NOT NULL,
	"version" text
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_identities" ADD CONSTRAINT "candidate_identities_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_identities" ADD CONSTRAINT "candidate_identities_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_log" ADD CONSTRAINT "export_log_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_log" ADD CONSTRAINT "export_log_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_log" ADD CONSTRAINT "export_log_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_steps" ADD CONSTRAINT "job_steps_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_story_group_id_media_story_groups_id_fk" FOREIGN KEY ("story_group_id") REFERENCES "public"."media_story_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_story_groups" ADD CONSTRAINT "media_story_groups_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_story_groups" ADD CONSTRAINT "media_story_groups_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_settings" ADD CONSTRAINT "owner_settings_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_latest_snapshot_id_snapshots_id_fk" FOREIGN KEY ("latest_snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_cache" ADD CONSTRAINT "provider_cache_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_cache" ADD CONSTRAINT "provider_cache_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_sources" ADD CONSTRAINT "relationship_sources_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_sources" ADD CONSTRAINT "relationship_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_parent_job_id_research_jobs_id_fk" FOREIGN KEY ("parent_job_id") REFERENCES "public"."research_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_selected_candidate_id_candidate_identities_id_fk" FOREIGN KEY ("selected_candidate_id") REFERENCES "public"."candidate_identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_owner_id_auth_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "candidate_identities_job_idx" ON "candidate_identities" USING btree ("job_id","rank");--> statement-breakpoint
CREATE INDEX "claims_snapshot_idx" ON "claims" USING btree ("snapshot_id","category");--> statement-breakpoint
CREATE INDEX "claims_conflict_idx" ON "claims" USING btree ("snapshot_id","conflict_group");--> statement-breakpoint
CREATE INDEX "contacts_snapshot_idx" ON "contacts" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "export_log_profile_idx" ON "export_log" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "issue_reports_profile_idx" ON "issue_reports" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_documents_job_url_idx" ON "job_documents" USING btree ("job_id","canonical_url");--> statement-breakpoint
CREATE UNIQUE INDEX "job_documents_job_key_idx" ON "job_documents" USING btree ("job_id","source_key");--> statement-breakpoint
CREATE INDEX "job_documents_expiry_idx" ON "job_documents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "job_events_job_idx" ON "job_events" USING btree ("job_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_steps_job_name_idx" ON "job_steps" USING btree ("job_id","name");--> statement-breakpoint
CREATE INDEX "media_items_snapshot_idx" ON "media_items" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "media_items_group_idx" ON "media_items" USING btree ("story_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_story_groups_snapshot_key_idx" ON "media_story_groups" USING btree ("snapshot_id","story_key");--> statement-breakpoint
CREATE INDEX "notes_profile_idx" ON "notes" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organisations_snapshot_name_idx" ON "organisations" USING btree ("snapshot_id","normalised_name");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_owner_anchor_idx" ON "profiles" USING btree ("owner_id","workspace","anchor_key");--> statement-breakpoint
CREATE INDEX "profiles_owner_updated_idx" ON "profiles" USING btree ("owner_id","workspace","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_cache_owner_key_idx" ON "provider_cache" USING btree ("owner_id","workspace","cache_key");--> statement-breakpoint
CREATE INDEX "provider_cache_expiry_idx" ON "provider_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "relationships_snapshot_idx" ON "relationships" USING btree ("snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "research_jobs_owner_idem_idx" ON "research_jobs" USING btree ("owner_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "research_jobs_claim_idx" ON "research_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "research_jobs_owner_idx" ON "research_jobs" USING btree ("owner_id","workspace","created_at");--> statement-breakpoint
CREATE INDEX "research_jobs_profile_idx" ON "research_jobs" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_profile_version_idx" ON "snapshots" USING btree ("profile_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_job_idx" ON "snapshots" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "snapshots_owner_idx" ON "snapshots" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "social_accounts_snapshot_idx" ON "social_accounts" USING btree ("snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_snapshot_url_idx" ON "sources" USING btree ("snapshot_id","canonical_url");--> statement-breakpoint
CREATE INDEX "sources_snapshot_idx" ON "sources" USING btree ("snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_owner_name_idx" ON "tags" USING btree ("owner_id","workspace","normalised_name");--> statement-breakpoint
CREATE INDEX "usage_records_owner_idx" ON "usage_records" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_single_owner_idx" ON "auth_users" USING btree ("role") WHERE "auth_users"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" USING btree ("identifier");