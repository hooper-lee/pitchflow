import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  unique,
  index,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "team_admin",
  "member",
  "viewer",
]);

export const planEnum = pgEnum("plan", ["free", "pro", "enterprise"]);

export const prospectStatusEnum = pgEnum("prospect_status", [
  "new",
  "contacted",
  "replied",
  "converted",
  "bounced",
  "unsubscribed",
]);

export const leadGradeEnum = pgEnum("lead_grade", ["A", "B", "C", "D"]);

export const researchStatusEnum = pgEnum("research_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
]);

export const emailStatusEnum = pgEnum("email_status", [
  "queued",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "bounced",
  "failed",
]);

export const aiProviderEnum = pgEnum("ai_provider", ["claude", "openai", "custom"]);
export const mailAccountStateEnum = pgEnum("mail_account_state", [
  "init",
  "connecting",
  "syncing",
  "connected",
  "authenticationError",
  "connectError",
  "disconnected",
  "unset",
]);
export const mailAccountAuthTypeEnum = pgEnum("mail_account_auth_type", ["imap_smtp", "oauth2"]);

// ── Tables ─────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  plan: planEnum("plan").default("free").notNull(),
  apiQuota: integer("api_quota").default(100),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash"),
    name: varchar("name", { length: 255 }),
    image: text("image"),
    role: userRoleEnum("role").default("member").notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    emailVerified: timestamp("email_verified"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("users_tenant_idx").on(table.tenantId),
  })
);

// ── NextAuth required tables ───────────────────────────

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => ({
    providerUnique: uniqueIndex(
      "accounts_provider_account_id_unique"
    ).on(table.provider, table.providerAccountId),
  })
);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    compoundPk: uniqueIndex("verification_tokens_identifier_token_unique").on(
      table.identifier,
      table.token
    ),
  })
);

// ── Business tables ────────────────────────────────────

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    body: text("body").notNull(),
    angle: varchar("angle", { length: 100 }),
    productName: varchar("product_name", { length: 255 }),
    senderName: varchar("sender_name", { length: 255 }),
    attachments: jsonb("attachments"),
    isDefault: boolean("is_default").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("email_templates_tenant_idx").on(table.tenantId),
  })
);

export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    companyName: varchar("company_name", { length: 500 }),
    contactName: varchar("contact_name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    linkedinUrl: text("linkedin_url"),
    whatsapp: varchar("whatsapp", { length: 50 }),
    industry: varchar("industry", { length: 255 }),
    country: varchar("country", { length: 100 }),
    website: text("website"),
    researchSummary: text("research_summary"),
    researchData: jsonb("research_data").$type<Record<string, unknown>>(),
    companyScore: integer("company_score"),
    matchScore: integer("match_score"),
    status: prospectStatusEnum("status").default("new").notNull(),
    source: varchar("source", { length: 100 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("prospects_tenant_idx").on(table.tenantId),
    statusIdx: index("prospects_status_idx").on(table.status),
    emailIdx: index("prospects_email_idx").on(table.email),
  })
);

export const mailAccounts = pgTable(
  "mail_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountKey: varchar("account_key", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    authType: mailAccountAuthTypeEnum("auth_type").default("imap_smtp").notNull(),
    state: mailAccountStateEnum("state").default("init").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    lastError: text("last_error"),
    syncTime: timestamp("sync_time"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("mail_accounts_tenant_idx").on(table.tenantId),
    userIdx: index("mail_accounts_user_idx").on(table.userId),
    tenantEmailUnique: unique("mail_accounts_tenant_email_unique").on(table.tenantId, table.email),
  })
);

// AI 调研信息表 - 存储 AI 抽取的结构化字段
export const prospectResearch = pgTable(
  "prospect_research",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    // 调研状态
    status: researchStatusEnum("status").default("pending").notNull(),
    // AI 生成的调研总结（原始）
    aiSummary: text("ai_summary"),
    // 结构化字段 - 公司概况
    companyDescription: text("company_description"), // 公司描述
    foundingYear: integer("founding_year"), // 成立年份
    employeeCount: varchar("employee_count", { length: 50 }), // 员工规模
    companyType: varchar("company_type", { length: 100 }), // 公司类型 (manufacturer, distributor, etc.)
    businessModel: varchar("business_model", { length: 100 }), // 商业模式
    // 结构化字段 - 产品/服务
    mainProducts: jsonb("main_products").$type<string[]>(), // 主要产品
    productCategories: jsonb("product_categories").$type<string[]>(), // 产品类别
    productionCapacity: text("production_capacity"), // 产能
    certifications: jsonb("certifications").$type<string[]>(), // 资质认证
    // 结构化字段 - 市场
    targetMarkets: jsonb("target_markets").$type<string[]>(), // 目标市场
    exportRegions: jsonb("export_regions").$type<string[]>(), // 出口地区
    keyMarkets: jsonb("key_markets").$type<string[]>(), // 主要市场
    // 结构化字段 - 采购
    procurementKeywords: jsonb("procurement_keywords").$type<string[]>(), // 采购关键词
    typicalOrderValue: varchar("typical_order_value", { length: 100 }), // 常规订单金额
    supplierCriteria: text("supplier_criteria"), // 供应商选择标准
    // 结构化字段 - 联系方式
    decisionMakers: jsonb("decision_makers").$type<
      { name: string; position: string; linkedin?: string }[]
    >(), // 决策人
    phoneNumbers: jsonb("phone_numbers").$type<string[]>(), // 电话
    addresses: jsonb("addresses").$type<string[]>(), // 地址
    // 结构化字段 - 社交媒体
    socialMedia: jsonb("social_media").$type<
      Record<string, string>
    >(), // 社交媒体链接
    // AI 原始输出（用于调试/重算）
    rawAiOutput: jsonb("raw_ai_output").$type<Record<string, unknown>>(),
    // 错误信息
    errorMessage: text("error_message"),
    // 时间戳
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    prospectUnique: uniqueIndex("prospect_research_prospect_unique").on(table.prospectId),
    prospectIdx: index("prospect_research_prospect_idx").on(table.prospectId),
    statusIdx: index("prospect_research_status_idx").on(table.status),
  })
);

// AI 评分表 - 存储5维度评分和等级
export const prospectScores = pgTable(
  "prospect_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" })
      .unique(),
    // 官网评分（原有字段，保留）
    websiteScore: integer("website_score"),
    websiteDimensions: jsonb("website_dimensions").$type<
      Record<string, number>
    >(),
    // 5维度评分 (0-100)
    icpFitScore: integer("icp_fit_score"), // ICP匹配度
    buyingIntentScore: integer("buying_intent_score"), // 采购意向
    reachabilityScore: integer("reachability_score"), // 可触达性
    dealPotentialScore: integer("deal_potential_score"), // 成交潜力
    riskPenaltyScore: integer("risk_penalty_score"), // 风险扣分
    // 综合评分 (0-100)
    overallScore: integer("overall_score"),
    // 客户分层
    leadGrade: leadGradeEnum("leadGrade"), // A/B/C/D
    priorityLevel: integer("priority_level"), // 优先级 (1-5)
    // 推荐动作
    recommendedAction: text("recommended_action"), // 推荐的开发动作
    actionReason: text("action_reason"), // 推荐理由
    // AI 评分原始输出
    rawAiOutput: jsonb("raw_ai_output").$type<Record<string, unknown>>(),
    // 时间戳
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    prospectIdx: index("prospect_scores_prospect_idx").on(table.prospectId),
    leadGradeIdx: index("prospect_scores_lead_grade_idx").on(table.leadGrade),
    overallScoreIdx: index("prospect_scores_overall_idx").on(table.overallScore),
  })
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 255 }).notNull(),
    industry: varchar("industry", { length: 255 }),
    targetPersona: varchar("target_persona", { length: 255 }),
    templateId: uuid("template_id").references(() => emailTemplates.id),
    mailAccountId: uuid("mail_account_id").references(() => mailAccounts.id),
    fromEmail: varchar("from_email", { length: 255 }),
    aiProvider: aiProviderEnum("ai_provider").default("custom"),
    aiConfig: jsonb("ai_config"),
    status: campaignStatusEnum("status").default("draft").notNull(),
    totalProspects: integer("total_prospects").default(0),
    sentCount: integer("sent_count").default(0),
    openedCount: integer("opened_count").default(0),
    repliedCount: integer("replied_count").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("campaigns_tenant_idx").on(table.tenantId),
  })
);

export const campaignProspects = pgTable(
  "campaign_prospects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    unique: unique("campaign_prospect_unique").on(table.campaignId, table.prospectId),
    campaignIdx: index("cp_campaign_idx").on(table.campaignId),
    prospectIdx: index("cp_prospect_idx").on(table.prospectId),
  })
);

export const emails = pgTable(
  "emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id),
    templateId: uuid("template_id").references(() => emailTemplates.id),
    mailAccountId: uuid("mail_account_id").references(() => mailAccounts.id),
    stepNumber: integer("step_number").default(1),
    subject: varchar("subject", { length: 500 }),
    body: text("body"),
    provider: varchar("provider", { length: 50 }).default("resend").notNull(),
    providerMessageId: varchar("provider_message_id", { length: 500 }),
    providerQueueId: varchar("provider_queue_id", { length: 255 }),
    messageHeaderId: varchar("message_header_id", { length: 500 }),
    threadId: varchar("thread_id", { length: 255 }),
    status: emailStatusEnum("status").default("queued").notNull(),
    resendId: varchar("resend_id", { length: 255 }),
    sentAt: timestamp("sent_at"),
    openedAt: timestamp("opened_at"),
    clickedAt: timestamp("clicked_at"),
    repliedAt: timestamp("replied_at"),
    bouncedAt: timestamp("bounced_at"),
    openCount: integer("open_count").default(0),
    clickCount: integer("click_count").default(0),
    highIntentAlertedAt: timestamp("high_intent_alerted_at"),
    clickAlertedAt: timestamp("click_alerted_at"),
    replyAlertedAt: timestamp("reply_alerted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("emails_campaign_idx").on(table.campaignId),
    prospectIdx: index("emails_prospect_idx").on(table.prospectId),
    statusIdx: index("emails_status_idx").on(table.status),
  })
);

export const emailReplies = pgTable(
  "email_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emailId: uuid("email_id")
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    mailAccountId: uuid("mail_account_id")
      .references(() => mailAccounts.id, { onDelete: "set null" }),
    providerMessageId: varchar("provider_message_id", { length: 500 }),
    threadId: varchar("thread_id", { length: 255 }),
    fromEmail: varchar("from_email", { length: 255 }),
    fromName: varchar("from_name", { length: 255 }),
    subject: varchar("subject", { length: 500 }),
    textBody: text("text_body"),
    htmlBody: text("html_body"),
    receivedAt: timestamp("received_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("email_replies_email_idx").on(table.emailId),
    prospectIdx: index("email_replies_prospect_idx").on(table.prospectId),
    providerMessageIdx: index("email_replies_provider_message_idx").on(table.providerMessageId),
  })
);

export const followupSequences = pgTable(
  "followup_sequences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    delayDays: integer("delay_days").notNull().default(3),
    angle: varchar("angle", { length: 100 }),
    templateId: uuid("template_id").references(() => emailTemplates.id),
    enabled: boolean("enabled").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignStepUnique: uniqueIndex("followup_campaign_step_unique").on(
      table.campaignId,
      table.stepNumber
    ),
  })
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 255 }).notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
    permissions: jsonb("permissions").$type<string[]>().default(["read"]),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("api_keys_tenant_idx").on(table.tenantId),
  })
);

export const systemConfigs = pgTable("system_configs", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    action: varchar("action", { length: 100 }).notNull(),
    resource: varchar("resource", { length: 100 }).notNull(),
    resourceId: uuid("resource_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    ip: varchar("ip", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("audit_logs_tenant_idx").on(table.tenantId),
    userIdx: index("audit_logs_user_idx").on(table.userId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  })
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    resource: varchar("resource", { length: 50 }).notNull(),
    quantity: integer("quantity").default(1).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("usage_records_tenant_idx").on(table.tenantId),
    resourceIdx: index("usage_records_resource_idx").on(table.resource),
    createdAtIdx: index("usage_records_created_at_idx").on(table.createdAt),
  })
);
