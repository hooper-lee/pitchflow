CREATE TABLE "agent_channel_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "channel" "agent_channel" NOT NULL,
  "name" varchar(255),
  "app_id" varchar(255),
  "app_secret" text,
  "webhook_secret" text,
  "is_enabled" boolean DEFAULT false NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "agent_channel_configs"
  ADD CONSTRAINT "agent_channel_configs_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade;

CREATE INDEX "agent_channel_configs_tenant_idx" ON "agent_channel_configs" USING btree ("tenant_id");

CREATE INDEX "agent_channel_configs_channel_idx" ON "agent_channel_configs" USING btree ("channel");

ALTER TABLE "agent_channel_configs"
  ADD CONSTRAINT "agent_channel_configs_tenant_channel_unique"
  UNIQUE ("tenant_id", "channel");
