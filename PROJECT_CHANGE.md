# Project Change: ICP Discovery Jobs + Candidate Review + Feedback Learning

> 目标：把 PitchFlow 的客户挖掘从“关键词实时搜索并直接入库”升级为“异步挖掘任务 + ICP 画像过滤 + 候选池审核 + 用户反馈学习”的完整闭环。
>
> 适用执行方：Codex / 开发 Agent
>
> 代码库：`hooper-lee/pitchflow`

---

## 0. 背景与当前问题

当前 PitchFlow 已具备客户挖掘、官网识别、AI 调研评分、活动发信和跟进能力。但当前“客户挖掘”更偏向：

```text
行业 / 关键词 / 国家 -> 搜索官网候选 -> 官网检测 -> 提取联系方式 -> 直接入库 prospects
```

这解决的是“这个搜索结果像不像真实公司官网”，但真实用户经常需要的是“这个公司是否符合我这一次定义的目标客户画像”。

真实需求示例：

```text
我要找 RTA / flat-pack furniture / modular furniture 相关客户，但必须是品牌方、设计工作室、home brand、furniture brand，
不是 manufacturer / factory / supplier。
产品需要消费者自行组装，偏 DTC 独立站，排除软装、成品家具、纯小件。
判断依据要看 About Us / Brand Story / Product / FAQ / Assembly 页面。
```

当前问题：

1. 用户只能输入行业、国家、关键词、limit，缺少“必须满足 / 必须排除 / 评分偏好”等 ICP 条件。
2. 挖掘是同步 API 执行，长链路会导致用户等待和请求超时风险。
3. 候选结果直接入库 prospects，缺少候选池、审核、拒绝原因和证据链。
4. 用户手动拒绝 / 拉黑 / 通过的数据没有沉淀，无法做到越用越准。
5. 当前只有基础去重，不足以支持跨任务、跨 ICP、跨候选历史的个性化去重与过滤。

---

## 1. 本次改造目标

实现 P1-P3：

### P1：异步 Discovery Job

将客户挖掘改为异步任务：

```text
POST /api/v1/discovery-jobs -> 创建 job -> 入队 BullMQ -> 立即返回 jobId
worker 后台执行搜索、抓取、过滤、AI 判定、候选落库
前端通过 jobId 查询进度和候选结果
```

### P2：ICP Profile

允许用户创建并复用目标客户画像：

```text
mustHave / mustNotHave / positiveKeywords / negativeKeywords / scoreWeights / minScoreToSave
```

支持用户用自然语言描述 ICP，系统可先保存为结构化 JSON。AI 自动生成规则可以后置，不作为本次必须项。

### P3：Candidate Review + Feedback Learning

新增候选池，不再所有结果直接进入 prospects。

用户可以：

```text
accept / reject / blacklist / restore / save_to_prospect
```

这些动作写入 feedback / blocklist，后续挖掘自动使用：

```text
blacklist 直接过滤
历史 rejected 默认隐藏或降权
历史 accepted 加分
手动 save_to_prospect 作为正样本
```

---

## 2. Codex 执行约束

请严格遵守以下约束：

1. 不要重写整个项目架构。
2. 不要引入 LangChain / LangGraph 作为本次必须依赖。
3. 优先复用现有技术栈：Next.js 14 App Router、Drizzle ORM、PostgreSQL、BullMQ、Redis、现有 detector、现有 AI custom/claude/openai 封装。
4. 不要破坏现有 `prospects`、`prospectResearch`、`prospectScores`、campaign、email 路径。
5. 保留现有 `POST /api/v1/prospects` 的兼容能力；可以新增 discovery jobs API，而不是直接移除旧能力。
6. 新功能必须按 tenant 隔离，所有查询和写入都必须带 `tenantId`。
7. 所有用户动作必须校验当前用户对 tenant 的权限。
8. 不要把 rejected / blacklisted 候选直接删除，必须保留可审计记录。
9. AI 输出必须使用 JSON schema 或强约束 JSON 解析，不允许依赖自由文本。
10. 所有 AI 判断必须保存 evidence / reason，前端需要能展示“为什么保留 / 为什么过滤”。
11. 所有外部抓取必须有 timeout、错误捕获和重试上限。
12. worker 必须支持失败状态回写，不允许 job 静默失败。
13. 数据库 schema 改动必须使用 Drizzle schema 定义，并保证 `npm run db:generate` / `npm run db:push` 可用。
14. 尽量避免大规模文件改动；按模块新增文件，保持可回滚。
15. 不要硬编码单一行业逻辑，例如 furniture / RTA 只能作为 seed 示例，不要写死到核心逻辑里。

---

## 3. 推荐目标架构

```text
Frontend
  ├─ ICP Profile Editor
  ├─ Discovery Job Create Form
  ├─ Discovery Progress Page
  └─ Candidate Review Table

API
  ├─ /api/v1/icp-profiles
  ├─ /api/v1/icp-profiles/:id
  ├─ /api/v1/discovery-jobs
  ├─ /api/v1/discovery-jobs/:id
  ├─ /api/v1/discovery-jobs/:id/candidates
  ├─ /api/v1/discovery-candidates/:id/action
  └─ /api/v1/discovery-candidates/:id/save

Queue
  └─ BullMQ discovery queue

Worker
  ├─ query expansion
  ├─ search
  ├─ normalize / dedupe
  ├─ blocklist filter
  ├─ crawl pages
  ├─ detector scoring
  ├─ rule filter
  ├─ AI classifier
  ├─ final scoring
  ├─ candidate persistence
  └─ auto save high-score prospects

DB
  ├─ icp_profiles
  ├─ lead_discovery_jobs
  ├─ lead_discovery_candidates
  ├─ lead_discovery_feedback
  ├─ lead_blocklist
  └─ prospects
```

---

## 4. 数据库改造

在 `lib/db/schema.ts` 中新增枚举和表。

### 4.1 新增 enums

```ts
export const discoveryJobStatusEnum = pgEnum("discovery_job_status", [
  "pending",
  "searching",
  "crawling",
  "filtering",
  "scoring",
  "reviewing",
  "completed",
  "failed",
  "cancelled",
]);

export const discoveryCandidateDecisionEnum = pgEnum("discovery_candidate_decision", [
  "pending",
  "accepted",
  "rejected",
  "needs_review",
  "blacklisted",
  "saved",
]);

export const discoveryFeedbackActionEnum = pgEnum("discovery_feedback_action", [
  "accept",
  "reject",
  "blacklist",
  "restore",
  "save_to_prospect",
]);

export const blocklistTypeEnum = pgEnum("blocklist_type", [
  "domain",
  "company",
  "keyword",
  "category",
  "pattern",
]);

export const blocklistScopeEnum = pgEnum("blocklist_scope", [
  "tenant",
  "user",
  "icp_profile",
]);
```

### 4.2 新增 `icp_profiles`

用途：保存用户可复用的目标客户画像。

字段建议：

```ts
export const icpProfiles = pgTable("icp_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  industry: varchar("industry", { length: 255 }),
  targetCustomerText: text("target_customer_text"),
  mustHave: jsonb("must_have").$type<string[]>().default([]),
  mustNotHave: jsonb("must_not_have").$type<string[]>().default([]),
  positiveKeywords: jsonb("positive_keywords").$type<string[]>().default([]),
  negativeKeywords: jsonb("negative_keywords").$type<string[]>().default([]),
  productCategories: jsonb("product_categories").$type<string[]>().default([]),
  salesModel: varchar("sales_model", { length: 100 }),
  scoreWeights: jsonb("score_weights").$type<Record<string, number>>().default({}),
  minScoreToSave: integer("min_score_to_save").default(80),
  minScoreToReview: integer("min_score_to_review").default(60),
  promptTemplate: text("prompt_template"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

索引：

```ts
tenantIdx: index("icp_profiles_tenant_idx").on(table.tenantId)
```

### 4.3 新增 `lead_discovery_jobs`

用途：保存一次异步挖掘任务。

字段建议：

```ts
export const leadDiscoveryJobs = pgTable("lead_discovery_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  icpProfileId: uuid("icp_profile_id").references(() => icpProfiles.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  status: discoveryJobStatusEnum("status").default("pending").notNull(),
  industry: varchar("industry", { length: 255 }),
  country: varchar("country", { length: 100 }),
  keywords: jsonb("keywords").$type<string[]>().default([]),
  inputQuery: text("input_query"),
  filters: jsonb("filters").$type<Record<string, unknown>>().default({}),
  targetLimit: integer("target_limit").default(50).notNull(),
  searchedCount: integer("searched_count").default(0).notNull(),
  crawledCount: integer("crawled_count").default(0).notNull(),
  candidateCount: integer("candidate_count").default(0).notNull(),
  acceptedCount: integer("accepted_count").default(0).notNull(),
  rejectedCount: integer("rejected_count").default(0).notNull(),
  savedCount: integer("saved_count").default(0).notNull(),
  progress: integer("progress").default(0).notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

索引：

```ts
tenantIdx
userIdx
statusIdx
createdAtIdx
```

### 4.4 新增 `lead_discovery_candidates`

用途：保存候选结果、评分、证据、过滤原因。注意：候选不等于 prospect。

字段建议：

```ts
export const leadDiscoveryCandidates = pgTable("lead_discovery_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => leadDiscoveryJobs.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  icpProfileId: uuid("icp_profile_id").references(() => icpProfiles.id, { onDelete: "set null" }),
  createdProspectId: uuid("created_prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  url: text("url"),
  finalUrl: text("final_url"),
  domain: varchar("domain", { length: 255 }),
  rootDomain: varchar("root_domain", { length: 255 }),
  companyName: varchar("company_name", { length: 500 }),
  title: text("title"),
  snippet: text("snippet"),
  source: varchar("source", { length: 100 }),
  searchQuery: text("search_query"),
  pagesFetched: jsonb("pages_fetched").$type<Record<string, unknown>[]>().default([]),
  rawText: text("raw_text"),
  detectorScore: integer("detector_score"),
  detectorDimensions: jsonb("detector_dimensions").$type<Record<string, number>>().default({}),
  ruleScore: integer("rule_score"),
  aiScore: integer("ai_score"),
  feedbackScore: integer("feedback_score"),
  finalScore: integer("final_score"),
  decision: discoveryCandidateDecisionEnum("decision").default("pending").notNull(),
  rejectReasons: jsonb("reject_reasons").$type<string[]>().default([]),
  matchedRules: jsonb("matched_rules").$type<string[]>().default([]),
  evidence: jsonb("evidence").$type<{ source: string; quote: string; reason?: string }[]>().default([]),
  contacts: jsonb("contacts").$type<Record<string, unknown>>().default({}),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

索引 / 唯一约束建议：

```ts
tenantIdx: index("lead_candidates_tenant_idx").on(table.tenantId)
jobIdx: index("lead_candidates_job_idx").on(table.jobId)
rootDomainIdx: index("lead_candidates_root_domain_idx").on(table.rootDomain)
decisionIdx: index("lead_candidates_decision_idx").on(table.decision)
scoreIdx: index("lead_candidates_final_score_idx").on(table.finalScore)

// 防止同一 job 内同 rootDomain 重复
uniqueJobDomain: unique("lead_candidates_job_root_domain_unique").on(table.jobId, table.rootDomain)
```

### 4.5 新增 `lead_discovery_feedback`

用途：保存用户对候选的行为反馈。

```ts
export const leadDiscoveryFeedback = pgTable("lead_discovery_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  jobId: uuid("job_id").references(() => leadDiscoveryJobs.id, { onDelete: "set null" }),
  candidateId: uuid("candidate_id").notNull().references(() => leadDiscoveryCandidates.id, { onDelete: "cascade" }),
  icpProfileId: uuid("icp_profile_id").references(() => icpProfiles.id, { onDelete: "set null" }),
  action: discoveryFeedbackActionEnum("action").notNull(),
  reason: text("reason"),
  reasonTags: jsonb("reason_tags").$type<string[]>().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 4.6 新增 `lead_blocklist`

用途：保存用户/租户/ICP 级别的拉黑规则。

```ts
export const leadBlocklist = pgTable("lead_blocklist", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  icpProfileId: uuid("icp_profile_id").references(() => icpProfiles.id, { onDelete: "cascade" }),
  type: blocklistTypeEnum("type").notNull(),
  value: varchar("value", { length: 500 }).notNull(),
  normalizedValue: varchar("normalized_value", { length: 500 }).notNull(),
  reason: text("reason"),
  scope: blocklistScopeEnum("scope").default("tenant").notNull(),
  sourceCandidateId: uuid("source_candidate_id").references(() => leadDiscoveryCandidates.id, { onDelete: "set null" }),
  sourceJobId: uuid("source_job_id").references(() => leadDiscoveryJobs.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

唯一约束建议：

```ts
uniqueBlock: unique("lead_blocklist_unique").on(
  table.tenantId,
  table.type,
  table.normalizedValue,
  table.scope,
  table.icpProfileId
)
```

如果 Drizzle 对 nullable unique 行为不符合预期，可先使用普通 index，并在 service 层做 upsert 防重。

---

## 5. 归一化与去重工具

新增文件：

```text
lib/discovery/normalize.ts
```

必须提供：

```ts
export function normalizeUrl(input: string): string | null
export function getHostname(input: string): string | null
export function getRootDomain(input: string): string | null
export function normalizeDomain(input: string): string | null
export function normalizeCompanyName(input: string): string
export function normalizeKeyword(input: string): string
```

实现要求：

1. 移除协议、路径尾部 slash、常见 tracking query。
2. 统一小写。
3. 移除 `www.` 前缀。
4. rootDomain 至少处理常见域名；不强制引入复杂 PSL 依赖，除非项目已有依赖。
5. 所有入库候选都必须有 `rootDomain`，没有 rootDomain 的候选默认拒绝或跳过。

去重分三层：

```text
1. 同 job 内：rootDomain 去重
2. 跨 job：tenantId + icpProfileId + rootDomain 历史决策检查
3. 入 prospects：tenantId + rootDomain / email / companyNameNormalized 防重
```

---

## 6. Queue 与 Worker 改造

### 6.1 新增 job schema

新增文件：

```text
lib/queue/jobs/discovery.job.ts
```

内容：

```ts
import { z } from "zod";

export const discoveryJobSchema = z.object({
  jobId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().optional(),
});

export type DiscoveryJobData = z.infer<typeof discoveryJobSchema>;
```

### 6.2 新增 worker

新增文件：

```text
lib/queue/workers/discovery.worker.ts
```

要求：

1. 使用现有 BullMQ connection。
2. 队列名称：`lead-discovery`。
3. 默认 concurrency = 1 或 2，避免抓取过载。
4. 每个阶段更新 `lead_discovery_jobs.status`、`progress`、计数字段。
5. worker 失败时写入 `failed`、`errorMessage`、`finishedAt`。
6. 支持 job 被取消：每个阶段开始前检查 DB job status 是否为 `cancelled`。

### 6.3 注册 worker

修改：

```text
scripts/start-workers.ts
```

增加：

```ts
import "@/lib/queue/workers/discovery.worker";
```

---

## 7. Discovery Pipeline Service

新增目录：

```text
lib/discovery/
```

建议文件：

```text
lib/discovery/types.ts
lib/discovery/normalize.ts
lib/discovery/query-expander.ts
lib/discovery/blocklist.ts
lib/discovery/rule-filter.ts
lib/discovery/ai-classifier.ts
lib/discovery/scoring.ts
lib/discovery/pipeline.ts
lib/services/discovery.service.ts
lib/services/icp-profile.service.ts
lib/services/discovery-feedback.service.ts
```

### 7.1 Pipeline 阶段

`runDiscoveryPipeline(jobId: string)` 按以下顺序执行：

```text
1. load job + icp profile
2. update status searching
3. generate search queries
4. call searchCompany / SearXNG integration
5. normalize candidates and dedupe by rootDomain
6. check existing prospects / previous candidates / blocklist
7. update status crawling
8. fetch homepage + about + brand story + product/collection + FAQ/assembly pages where discoverable
9. run detector / extractContacts
10. update status filtering
11. run ruleFilter
12. run AI classifier for non-obvious candidates
13. update status scoring
14. calculate finalScore
15. persist candidate with evidence/reasons
16. auto save high-score candidates to prospects
17. update job stats and status completed/reviewing
```

### 7.2 Query Expansion

`buildDiscoveryQueries(job, icpProfile)` 返回 string[]。

规则：

1. 基础 query 包含 job keywords / industry / country。
2. ICP positiveKeywords 加入扩展。
3. 不要硬编码 manufacturer / supplier 作为默认词。
4. 对英文场景可以加：`official site`, `brand`, `store`。
5. 对中文场景可以加：`品牌`, `官网`, `独立站`。
6. 最多生成 5-8 条 query，避免搜索爆炸。

示例：

```ts
[
  "RTA furniture brand United States official site",
  "flat-pack furniture DTC brand United States",
  "modular furniture home brand Shopify",
]
```

### 7.3 Blocklist Filter

`isBlockedCandidate(tenantId, icpProfileId, candidate)`：

检查：

```text
- type=domain: rootDomain 命中
- type=company: normalized company name 命中
- type=keyword/category/pattern: title/snippet/rawText 命中
```

作用范围：

```text
tenant scope：所有任务生效
user scope：当前 user 生效
icp_profile scope：当前 ICP 生效
```

### 7.4 Rule Filter

输入：candidate text + icpProfile。

输出：

```ts
{
  ruleScore: number;
  matchedRules: string[];
  rejectReasons: string[];
  evidence: { source: string; quote: string; reason?: string }[];
  hardReject: boolean;
}
```

要求：

1. positiveKeywords 命中加分。
2. negativeKeywords 命中扣分。
3. mustNotHave 高置信命中可 hardReject，但要保留 evidence。
4. mustHave 缺失不一定 hardReject，可交给 AI 判定。
5. 不要简单因为出现 `manufacturer` 就 hardReject，要结合语境；比如 `not a manufacturer` 不应当负向。

### 7.5 AI Classifier

新增：

```text
lib/discovery/ai-classifier.ts
```

函数：

```ts
export async function classifyCandidateWithAI(input: DiscoveryAiClassifyInput): Promise<DiscoveryAiClassifyOutput>
```

输出必须是 JSON：

```ts
export interface DiscoveryAiClassifyOutput {
  isTargetCustomer: boolean;
  confidence: number;
  scores: {
    businessModelFit: number;
    productFit: number;
    salesModelFit: number;
    exclusionRisk: number;
  };
  matchedRequirements: string[];
  rejectionReasons: string[];
  evidence: { source: string; quote: string; reason?: string }[];
  recommendedDecision: "accepted" | "rejected" | "needs_review";
  reasoning: string;
}
```

Prompt 要求：

```text
你是 B2B/B2C 外贸获客 ICP 评估器。
只能基于输入证据判断，不允许编造。
如果证据不足，返回 needs_review。
输出严格 JSON，不要 markdown。
```

输入包含：

```text
companyName, domain, homepageText, aboutText, productText, faqText, search snippet, detector signals, icpProfile
```

### 7.6 Final Scoring

新增：

```text
lib/discovery/scoring.ts
```

建议初始公式：

```text
finalScore =
  detectorScore * 0.20
+ ruleScore * 0.25
+ aiScore * 0.40
+ feedbackScore * 0.15
```

如果无 AI 结果，则：

```text
finalScore = detectorScore * 0.35 + ruleScore * 0.50 + feedbackScore * 0.15
```

默认决策：

```text
finalScore >= icp.minScoreToSave    -> accepted，可自动入库
finalScore >= icp.minScoreToReview  -> needs_review
finalScore <  minScoreToReview      -> rejected
blocklist 命中                         -> blacklisted
hardReject                            -> rejected
```

---

## 8. API 设计

### 8.1 ICP Profiles

#### GET `/api/v1/icp-profiles`

返回当前 tenant 下 profiles。

#### POST `/api/v1/icp-profiles`

创建 profile。

请求：

```json
{
  "name": "RTA Furniture DTC Brands",
  "description": "Find flat-pack / RTA furniture brands, exclude factories.",
  "industry": "furniture",
  "targetCustomerText": "品牌方、设计工作室、home brand、furniture brand，不是 manufacturer/factory。产品需要消费者自行组装，偏 DTC 独立站。",
  "mustHave": ["brand owner", "design studio", "DTC", "consumer self-assembly"],
  "mustNotHave": ["manufacturer", "factory", "supplier", "soft furnishing", "finished assembled furniture"],
  "positiveKeywords": ["RTA", "flat-pack", "ready-to-assemble", "modular", "easy assembly", "home brand", "furniture brand"],
  "negativeKeywords": ["OEM", "factory direct", "wholesale only", "manufacturer", "supplier", "pillow", "bedding"],
  "productCategories": ["RTA furniture", "flat-pack furniture", "modular furniture"],
  "salesModel": "DTC",
  "scoreWeights": {
    "businessModelFit": 30,
    "productFit": 30,
    "salesModelFit": 20,
    "exclusionRisk": 20
  },
  "minScoreToSave": 80,
  "minScoreToReview": 60
}
```

#### PATCH `/api/v1/icp-profiles/:id`

更新 profile。

#### DELETE `/api/v1/icp-profiles/:id`

软删除可后置；本次可先硬删，但必须限定 tenant。

### 8.2 Discovery Jobs

#### POST `/api/v1/discovery-jobs`

创建异步任务。

请求：

```json
{
  "name": "US RTA Furniture Brands",
  "icpProfileId": "uuid",
  "industry": "furniture",
  "country": "United States",
  "keywords": ["RTA furniture", "flat-pack furniture", "modular furniture"],
  "targetLimit": 100
}
```

返回：

```json
{
  "id": "job_uuid",
  "status": "pending"
}
```

行为：

```text
1. requireTenant()
2. validate input
3. create lead_discovery_jobs
4. enqueue BullMQ lead-discovery
5. return job
```

#### GET `/api/v1/discovery-jobs`

分页返回当前 tenant 的 jobs。

#### GET `/api/v1/discovery-jobs/:id`

返回 job 详情和统计。

#### POST `/api/v1/discovery-jobs/:id/cancel`

将 status 设置为 `cancelled`。worker 在阶段边界停止。

### 8.3 Candidates

#### GET `/api/v1/discovery-jobs/:id/candidates`

查询候选。

Query 参数：

```text
page, limit, decision, minScore, search
```

#### POST `/api/v1/discovery-candidates/:id/action`

用户动作。

请求：

```json
{
  "action": "reject",
  "reason": "不是品牌方，是工厂",
  "reasonTags": ["factory", "not_brand"]
}
```

支持 action：

```text
accept
reject
blacklist
restore
save_to_prospect
```

行为：

```text
accept -> candidate.decision = accepted，写 feedback
reject -> candidate.decision = rejected，写 feedback
blacklist -> candidate.decision = blacklisted，写 feedback，并写 lead_blocklist
restore -> candidate.decision = needs_review 或 pending，写 feedback
save_to_prospect -> 创建 prospect，candidate.decision = saved，写 feedback
```

#### POST `/api/v1/discovery-candidates/:id/save`

等价于 action=save_to_prospect。

---

## 9. 保存 candidate 到 prospect 的规则

新增 service 函数：

```ts
saveCandidateToProspect(candidateId: string, tenantId: string, userId?: string)
```

要求：

1. 读取 candidate，必须 tenant 匹配。
2. 如果 `createdProspectId` 已存在，直接返回已有 prospect。
3. 根据 rootDomain 检查同 tenant 下是否已有 prospect。
4. 根据 email 检查是否已有 prospect。
5. 根据 companyNameNormalized 尽量避免重复。
6. 创建 prospect 时写入：

```ts
{
  tenantId,
  companyName: candidate.companyName || candidate.domain,
  email: candidate.contacts?.emails?.[0] || inferredEmail,
  website: candidate.finalUrl || candidate.url,
  industry: job.industry || icp.industry,
  country: job.country,
  source: "discovery_candidate",
  status: "new",
  researchSummary: candidate.snippet,
  companyScore: candidate.detectorScore,
  matchScore: candidate.finalScore,
  metadata: {
    discoveryJobId,
    discoveryCandidateId,
    icpProfileId,
    rootDomain,
    detectorScore,
    ruleScore,
    aiScore,
    feedbackScore,
    finalScore,
    evidence,
    rejectReasons,
    matchedRules
  }
}
```

7. 更新 candidate：

```ts
createdProspectId = prospect.id
decision = "saved"
```

8. 写入 feedback：`save_to_prospect`。

---

## 10. 前端改造

### 10.1 ICP Profile 页面

建议路径：

```text
app/(dashboard)/icp-profiles
```

或放在：

```text
app/(dashboard)/prospects/icp-profiles
```

页面能力：

1. profile 列表。
2. 创建 / 编辑 profile。
3. 字段包含：
   - name
   - targetCustomerText
   - mustHave
   - mustNotHave
   - positiveKeywords
   - negativeKeywords
   - productCategories
   - salesModel
   - minScoreToSave
   - minScoreToReview
4. 初期可以用 textarea + tag input，不必做复杂 AI 表单。

### 10.2 Discovery Job 创建入口

建议在 prospects 页面新增“精准挖掘”按钮。

表单字段：

```text
name
icpProfileId
industry
country
keywords
targetLimit
```

提交后跳转：

```text
/prospects/discovery-jobs/:id
```

### 10.3 Discovery Job 详情页

展示：

```text
job status
progress
searchedCount
crawledCount
candidateCount
acceptedCount
rejectedCount
savedCount
```

候选表格列：

```text
Company
Domain
Final Score
Decision
Matched Rules
Reject Reasons
Evidence Count
Actions
```

动作：

```text
Accept
Reject
Blacklist
Save to Prospects
Restore
```

候选详情 Drawer：

```text
- Homepage / About / Product / FAQ 摘要
- AI 判断结果
- Evidence quotes
- Matched rules
- Reject reasons
- Contacts
```

### 10.4 轮询策略

前端每 2-5 秒轮询 job 详情。

当状态为：

```text
completed / failed / cancelled
```

停止轮询。

---

## 11. 用户反馈学习逻辑

本次先做规则型学习，不做模型训练。

### 11.1 blacklist

用户执行 blacklist 后：

```text
1. candidate.decision = blacklisted
2. lead_discovery_feedback 记录 action=blacklist
3. lead_blocklist 写入 type=domain, normalizedValue=rootDomain
4. 后续相同 tenant / icpProfile 下直接过滤
```

### 11.2 rejected 历史

后续挖掘命中历史 rejected 的 rootDomain：

```text
- 默认不自动入库
- 可直接标记 rejected 或 needs_review
- metadata 标记 previousRejected=true
```

### 11.3 accepted / saved 历史

命中历史 accepted / saved 的 rootDomain：

```text
- 如果已存在 prospect，标记 duplicate_existing_prospect
- 如果没有 prospect，可加 feedbackScore
```

### 11.4 reasonTags 降权

统计同 ICP 下最近 N 条 feedback：

```text
factory / not_brand / not_dtc / wrong_product / no_assembly / soft_furnishing
```

如果候选规则命中相同标签，降低 feedbackScore。

本次可以先实现简单版本：

```text
命中 blacklist: feedbackScore = -100
历史 rejected: feedbackScore = -30
历史 accepted/saved: feedbackScore = +20
无历史: feedbackScore = 0
```

---

## 12. 测试要求

至少添加或手动验证以下场景：

### 12.1 DB / service

1. 创建 ICP profile 成功。
2. 创建 discovery job 成功并入队。
3. worker 执行失败时 job 状态变 failed。
4. candidate 同 job rootDomain 不重复。
5. blacklist 后相同 rootDomain 再次挖掘会过滤。
6. save candidate 后创建 prospect。
7. 重复 save candidate 不创建重复 prospect。
8. reject / accept / blacklist 都写 feedback。

### 12.2 API

1. 非当前 tenant 无法访问 job / candidate。
2. 无效 icpProfileId 返回错误。
3. candidate action 只接受允许枚举。
4. cancel job 后 worker 不继续执行后续阶段。

### 12.3 前端

1. 可以创建 ICP profile。
2. 可以创建 discovery job。
3. job 页面能看到进度。
4. 候选能执行 accept / reject / blacklist / save。
5. saved 后 prospects 列表能看到客户。

---

## 13. 验收标准

完成后应满足：

1. 用户可以创建 ICP Profile。
2. 用户可以基于 ICP Profile 启动异步 Discovery Job。
3. API 不再需要等待完整挖掘完成才返回。
4. worker 会搜索、去重、抓取、规则过滤、AI 判定、候选落库。
5. 高分候选可以自动标记 accepted，达到阈值可自动入库 prospects。
6. 中等分数候选进入 needs_review。
7. 低分或命中硬排除候选进入 rejected。
8. 用户可以手动 accept / reject / blacklist / save。
9. blacklist 会影响后续任务。
10. candidate 保留 evidence、matchedRules、rejectReasons。
11. prospects 入库仍保持去重，不重复创建同域名客户。
12. 现有客户列表、调研、活动、邮件功能不被破坏。

---

## 14. 推荐开发顺序

### Step 1：Schema

- 添加 enums
- 添加 icpProfiles
- 添加 leadDiscoveryJobs
- 添加 leadDiscoveryCandidates
- 添加 leadDiscoveryFeedback
- 添加 leadBlocklist
- 运行 drizzle generate / push

### Step 2：Normalize + Service 基础

- normalize 工具
- icp profile CRUD service
- discovery job create/list/get service
- candidate list/action service

### Step 3：Queue

- discovery.job.ts
- discovery.worker.ts
- start-workers.ts 注册
- create job 后入队

### Step 4：Pipeline MVP

- query expansion
- search
- normalize / dedupe
- blocklist
- detector / fetch
- rule filter
- AI classifier
- scoring
- candidate persistence

### Step 5：Candidate Actions

- accept / reject / blacklist / restore / save
- feedback 写入
- blocklist 写入
- save to prospect 去重

### Step 6：Frontend

- ICP profile 页面
- 创建 discovery job 表单
- job progress 页面
- candidate review table

### Step 7：Polish

- 错误处理
- loading / empty states
- audit log
- quota integration
- batch save accepted candidates

---

## 15. 重要实现细节

### 15.1 不要把 candidate 直接等同于 prospect

candidate 是“发现到的候选”。prospect 是“确认要联系/管理的客户”。

只有以下情况才进入 prospects：

```text
- finalScore >= minScoreToSave 且配置允许自动入库
- 用户手动 save_to_prospect
- 用户批量 save accepted
```

### 15.2 Evidence 是核心字段

AI 和规则过滤必须尽量产出 evidence，例如：

```json
[
  {
    "source": "about",
    "quote": "We are a design-led furniture brand for modern homes.",
    "reason": "matches brand positioning"
  },
  {
    "source": "product",
    "quote": "Ships flat and assembles in minutes.",
    "reason": "matches self-assembly requirement"
  }
]
```

没有 evidence 的高分结果应降级为 needs_review。

### 15.3 AI 不确定时不要强判

当页面信息不足时：

```text
recommendedDecision = needs_review
confidence < 0.6
```

不要因为猜测而 accepted。

### 15.4 兼容现有 detector

现有 detector 负责“官网像不像真实官网”。新增 ICP classifier 负责“是否符合用户目标客户画像”。两者不要混在一起。

```text
detectorScore: website quality / official website confidence
aiScore/ruleScore: ICP fit
finalScore: combined score
```

### 15.5 Quota

初期可以按 job 创建消耗 quota，后续再细分 search / AI / candidate 数量。

不要在 worker 中无限制调用 AI。

建议：

```text
每个 job AI classify 上限 = min(targetLimit * 3, 100)
明显 rejected / blacklisted / low detector score 的候选不调用 AI
```

---

## 16. 示例 ICP Seed（可选）

可以在开发环境 seed 一个示例 ICP，但不要写死到核心逻辑。

```json
{
  "name": "RTA / Flat-pack Furniture DTC Brands",
  "industry": "furniture",
  "targetCustomerText": "Find furniture brands, design studios, home brands or DTC furniture brands that sell ready-to-assemble, flat-pack or modular furniture. Exclude manufacturers, factories, OEM suppliers, soft furnishing brands, fully assembled furniture and small decor-only stores.",
  "mustHave": [
    "brand owner or design studio",
    "DTC or direct-to-consumer store",
    "ready-to-assemble / flat-pack / modular / self-assembly product"
  ],
  "mustNotHave": [
    "manufacturer",
    "factory",
    "OEM supplier",
    "wholesale only",
    "soft furnishing",
    "fully assembled furniture",
    "small decor-only products"
  ],
  "positiveKeywords": [
    "RTA",
    "ready-to-assemble",
    "flat-pack",
    "flat pack",
    "modular",
    "easy assembly",
    "assembles in minutes",
    "furniture brand",
    "home brand",
    "design studio"
  ],
  "negativeKeywords": [
    "manufacturer",
    "factory",
    "OEM",
    "supplier",
    "wholesale only",
    "pillow",
    "bedding",
    "blanket",
    "home decor only"
  ],
  "salesModel": "DTC",
  "minScoreToSave": 80,
  "minScoreToReview": 60
}
```

---

## 17. 非目标范围

本次不要做：

1. 不要训练自定义模型。
2. 不要引入复杂向量数据库。
3. 不要大规模重构现有 prospects / campaigns / emails。
4. 不要强制接入 LangGraph。
5. 不要做浏览器自动化 Playwright 深抓，除非现有 detector 已支持开关。
6. 不要做多用户实时协同审核。
7. 不要做复杂推荐系统，只做 rule-based feedback learning。

---

## 18. 最终交付物

Codex 完成后应提交：

```text
1. DB schema 更新
2. migration / drizzle 生成文件
3. discovery queue job + worker
4. discovery pipeline service
5. ICP profile APIs
6. Discovery job APIs
7. Candidate action APIs
8. 前端 ICP profile 页面
9. 前端 discovery job 创建与详情页面
10. candidate review table
11. 基础测试或手动测试说明
12. README 或开发说明更新
```

---

## 19. 一句话原则

本次改造的核心不是“多找客户”，而是：

```text
让用户定义什么是好客户，让系统把每一次接受、拒绝、拉黑都沉淀为下一次更精准的过滤条件。
```
