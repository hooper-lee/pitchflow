CREATE TABLE "agent_channel_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "channel" "agent_channel" NOT NULL,
  "external_event_id" varchar(255) NOT NULL,
  "external_user_id" varchar(255),
  "external_chat_id" varchar(255),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "agent_channel_events"
  ADD CONSTRAINT "agent_channel_events_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX "agent_channel_events_tenant_idx" ON "agent_channel_events" USING btree ("tenant_id");
CREATE INDEX "agent_channel_events_channel_idx" ON "agent_channel_events" USING btree ("channel");
CREATE INDEX "agent_channel_events_created_at_idx" ON "agent_channel_events" USING btree ("created_at");

ALTER TABLE "agent_channel_events"
  ADD CONSTRAINT "agent_channel_events_channel_event_unique"
  UNIQUE ("channel", "external_event_id");
