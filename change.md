# Change: Multi-Source ICP Discovery Search + Precision Evaluation

> 执行方：Codex / 开发 Agent
>
> 仓库：`hooper-lee/pitchflow`
>
> 目标：在现有 ICP Discovery Jobs 基础上，把单一 SearXNG 搜索升级为“多意图 / 可扩展多源召回 + 可量化精准性验证”的闭环。

---

## 0. 背景

当前版本已经具备 ICP Profile、Discovery Job、Candidate Review、Feedback Learning、Rule Filter、AI Classifier、Final Scoring 等基础能力。

但当前搜索召回层仍然偏单一：

```text
buildDiscoveryQueries -> searchCompany -> SearXNG general search -> detector -> ICP filter / AI classifier
```

这会导致一个核心问题：

```text
后面的 ICP 判断链路已经有了，但前面的搜索召回池质量不稳定。
```

如果搜索阶段召回的大量结果是 marketplace、目录站、新闻文章、社媒页、工厂/供应商页面，那么后续规则和 AI 再强，也是在低质量候选池里筛选，成本高、误判多、结果不稳定。

本次改造重点不是继续堆 ICP 条件，而是提升：

```text
1. Search 召回质量
2. 多意图查询覆盖
3. 多源搜索可扩展性
4. 结果精准性可验证性
```

---

## 1. 本次目标

### P1：新增 Search Orchestrator

将当前 pipeline 中直接调用 `searchCompany(query)` 的方式，升级为统一搜索编排器：

```ts
searchDiscoverySources({
  queries,
  icpProfile,
  job,
  targetLimit,
})
```

输出统一格式：

```ts
interface DiscoverySearchResult {
  title: string;
  link: string;
  snippet: string;
  sourceProvider: string;
  query: string;
  queryIntent: DiscoveryQueryIntent;
  rawRank: number;
  sourceConfidence: number;
  metadata?: Record<string, unknown>;
}
```

### P2：多意图查询生成

在现有 `query-expander.ts` 基础上，不再只生成普通 query，而是生成带 intent 的查询。

目标 intent：

```ts
type DiscoveryQueryIntent =
  | "product"
  | "brand"
  | "dtc"
  | "official_site"
  | "platform"
  | "problem_scene"
  | "broad";
```

例如 RTA furniture ICP 应生成：

```text
product:        RTA furniture brand United States
product:        flat-pack furniture store United States
brand:          ready-to-assemble furniture brand official site
brand:          modular furniture home brand
DTC:            DTC furniture brand United States
platform:       Shopify flat-pack furniture brand
problem_scene:  easy assembly furniture brand
broad:          furniture brand United States official site
```

### P3：保留 SearXNG，但抽象 Provider

第一阶段仍然只必须实现 SearXNG provider，不强制接入付费搜索 API。

但代码结构必须支持后续添加：

```text
Brave Search
SerpAPI / Google
Bing
Shopify / Store Leads
BuiltWith / Wappalyzer
行业目录源
社媒验证源
```

### P4：新增搜索结果质量打分

在进入 detector 前，对搜索结果做轻量 source quality scoring。

目标：优先把更像品牌官网 / 独立站的结果送入抓取和 AI 判断，降低 marketplace、目录页、文章页污染。

### P5：新增精准性验证体系

新增 Golden Set 和 Eval 脚本，能够量化：

```text
Search Recall
Official Site Rate
Precision@20
False Positive
False Negative
Marketplace Pollution
Duplicate Rate
Query Intent Contribution
```

---

## 2. 严格执行约束

### 2.1 架构约束

1. 不要重写整个 Discovery Pipeline。
2. 不要破坏现有 ICP Profile、Discovery Job、Candidate Review、Feedback Learning、Campaign、Email 路径。
3. 不要移除现有 SearXNG 能力。
4. 不要直接把外部搜索 API 写死到 pipeline 中。
5. 搜索 provider 必须通过统一接口接入。
6. Pipeline 只依赖 search orchestrator，不直接依赖具体 provider。
7. 本次不强制引入 LangChain / LangGraph。
8. 本次不强制引入付费 API。
9. 新代码优先新增模块，减少对旧文件的大规模侵入式修改。
10. 所有新增功能必须保持 tenant 隔离。

### 2.2 搜索行为约束

1. 不要把某一个行业逻辑写死到核心逻辑里。
2. RTA / furniture 只能作为 eval 示例和 seed 示例，不允许写死到搜索核心。
3. negative keywords 不要直接全部拼成搜索引擎的 `-keyword`，避免误伤召回。
4. negative keywords 可以用于搜索结果初筛降权，但不要在 search 阶段直接强删除，除非命中全局排除域名。
5. marketplace / directory / social / media 可以降权或标记，不应一律删除；其中社媒可作为验证源，但默认不作为官网候选直接入库。
6. 每个候选必须保存来源：`sourceProvider`、`query`、`queryIntent`、`rawRank`。
7. 多源结果必须按 rootDomain 去重，但要保留 source evidence 到 metadata。
8. 搜索结果必须有超时、错误捕获、单 provider 失败不能导致整个 job 失败。
9. 每个 provider 必须有最大结果数限制，避免搜索爆炸。
10. 默认每个 job 总搜索候选不要超过 `targetLimit * 5`，进入抓取阶段不要超过 `targetLimit * 3`。

### 2.3 精准性验证约束

1. 必须新增 eval 数据结构，不能只靠人工感觉判断准不准。
2. Eval 脚本必须可以本地运行。
3. Eval 输出必须包含错误样本，而不是只输出总分。
4. Golden Set 不要提交真实敏感客户数据。
5. Eval 允许使用公开官网 URL、示例 URL 或人工标注样本。
6. Eval 指标至少包含 Precision@20、Official Site Rate、False Positive examples、False Negative examples。
7. 每次修改 query-expander、rule-filter、AI classifier、scoring 时，应能复跑 eval。

### 2.4 代码质量约束

1. TypeScript 类型必须明确，避免 `any`。
2. Provider 接口必须稳定、可单测。
3. 新增模块必须可独立测试。
4. 不要在生产路径里打印大量敏感内容。
5. AI prompt / search query 可以记录摘要，但不要记录 API key 或用户私密配置。
6. 所有外部请求必须有 timeout。
7. 所有新增 env 必须同步更新 `.env.example` 和 `.env.production.example`。
8. 如果新增 npm script，必须更新 `package.json`。
9. 不要把 eval 数据跑进生产数据库。
10. 不要在 eval 脚本里默认写入 prospects。

---

## 3. 推荐目录结构

新增：

```text
lib/discovery/search/
  types.ts
  query-intents.ts
  search-orchestrator.ts
  source-scoring.ts
  providers/
    searxng.provider.ts
    index.ts

scripts/
  eval-discovery-search.ts
  eval-icp-classifier.ts

data/
  eval/
    icp-golden-set.example.json
```

可选后续新增：

```text
lib/discovery/search/providers/
  brave.provider.ts
  serpapi.provider.ts
  shopify.provider.ts
  directory.provider.ts
  social-verification.provider.ts
```

---

## 4. Search Provider 设计

### 4.1 Provider 接口

新增：`lib/discovery/search/types.ts`

```ts
export type DiscoveryQueryIntent =
  | "product"
  | "brand"
  | "dtc"
  | "official_site"
  | "platform"
  | "problem_scene"
  | "broad";

export interface DiscoverySearchQuery {
  query: string;
  intent: DiscoveryQueryIntent;
  maxResults: number;
  country?: string | null;
  language?: string | null;
}

export interface DiscoverySearchResult {
  title: string;
  link: string;
  snippet: string;
  sourceProvider: string;
  query: string;
  queryIntent: DiscoveryQueryIntent;
  rawRank: number;
  sourceConfidence: number;
  metadata?: Record<string, unknown>;
}

export interface DiscoverySearchProvider {
  name: string;
  enabled(): Promise<boolean> | boolean;
  search(query: DiscoverySearchQuery): Promise<DiscoverySearchResult[]>;
}
```

### 4.2 SearXNG Provider

把当前 `lib/integrations/serpapi.ts` 中的 SearXNG 搜索逻辑迁移或封装到：

```text
lib/discovery/search/providers/searxng.provider.ts
```

要求：

1. 保持兼容现有 `SEARXNG_URL`。
2. 文件命名不要再叫 `serpapi.ts`，避免语义混乱。
3. 可以暂时保留旧 `searchCompany`，但内部建议转调新的 provider / orchestrator。
4. 默认 categories 使用 `general`。
5. 每页最多 10 条，支持多页。
6. 单请求 timeout 建议 8-12 秒。
7. 返回结果必须包含 `sourceProvider = "searxng"`。
8. 对 EXCLUDE_DOMAINS 继续保留，但建议迁移到 source scoring 或 shared filter。

---

## 5. Query Intent 生成

当前 `query-expander.ts` 返回 `string[]`。

建议升级为：

```ts
export interface DiscoveryExpandedQuery {
  query: string;
  intent: DiscoveryQueryIntent;
  priority: number;
}

export function buildDiscoveryQueries(...): DiscoveryExpandedQuery[]
```

### 5.1 生成原则

从 ICP 中提取：

```text
job.keywords
job.industry
job.country
job.inputQuery
icpProfile.industry
icpProfile.positiveKeywords
icpProfile.productCategories
icpProfile.salesModel
icpProfile.mustHave 中适合召回的短词
```

不要直接用：

```text
mustNotHave
negativeKeywords
```

它们用于降权、过滤和 AI 判断，不直接用于 query 扩展。

### 5.2 Query 组合方式

至少生成以下 intent：

#### product

```text
{productCategory or positiveKeyword} {industry} {country} brand
{productCategory or positiveKeyword} {country} store
```

#### brand

```text
{productCategory} brand official site
{industry} home brand {country}
```

#### dtc

只有当 `salesModel` 或 positiveKeywords 暗示 DTC / B2C / direct-to-consumer 时生成：

```text
DTC {industry} brand {country}
direct to consumer {productCategory} brand
```

#### official_site

```text
{keyword} {country} official site
{keyword} brand website
```

#### platform

```text
Shopify {productCategory} brand
WooCommerce {productCategory} store
```

#### problem_scene

从 mustHave / positiveKeywords 中找场景词，如：

```text
easy assembly furniture brand
space saving furniture brand
modular home furniture store
```

#### broad

兜底宽泛 query：

```text
{industry} brand {country} official site
```

### 5.3 限制

1. 默认最多生成 12 条 expanded queries。
2. 按 priority 排序。
3. 去重时忽略大小写和多空格。
4. 每个 intent 至少保留 1 条，除非缺少足够词。
5. 不要因为某个 ICP 是中文，就只生成中文；允许中英混合，但要保留 language hint。

---

## 6. Search Orchestrator

新增：`lib/discovery/search/search-orchestrator.ts`

职责：

```text
1. 接收 expanded queries
2. 调用 enabled providers
3. 合并结果
4. 按 rootDomain 去重
5. 计算 sourceQualityScore
6. 保留 source evidence
7. 返回给 pipeline
```

建议接口：

```ts
export async function searchDiscoverySources(input: {
  queries: DiscoveryExpandedQuery[];
  targetLimit: number;
  country?: string | null;
  language?: string | null;
}): Promise<DiscoverySearchResult[]>;
```

### 6.1 Provider 调用策略

第一版：

```text
providers = [searxngProvider]
```

后续可配置：

```text
SEARCH_PROVIDERS=searxng,brave,serpapi
```

但本次不强制实现 Brave / SerpAPI。

### 6.2 去重策略

按 rootDomain 去重。

同 rootDomain 多次出现时：

```text
1. 保留 sourceQualityScore 最高的结果
2. 如果分数接近，保留 rawRank 更靠前的结果
3. metadata.sources 中保存所有来源 query / provider / intent / rank
```

---

## 7. Source Quality Scoring

新增：`lib/discovery/search/source-scoring.ts`

目标：在抓取前做轻量排序，不做最终 ICP 判断。

### 7.1 加分信号

```text
+ title/snippet/url 命中 brand / official site / store
+ url 看起来是独立域名首页或浅层路径
+ queryIntent 是 product / brand / dtc / official_site
+ 同 rootDomain 被多个 queryIntent 命中
+ snippet 命中 productCategories / positiveKeywords
+ 域名不是大型平台或目录
```

### 7.2 降权信号

```text
- marketplace：amazon, alibaba, ebay, made-in-china, 1688
- social only：linkedin, instagram, facebook, tiktok, pinterest
- directory：yellowpages, crunchbase, glassdoor, indeed 等
- media/article：news, blog article, review article
- title/snippet 命中 negativeKeywords / mustNotHave
- URL 过深，像文章页、搜索页、分类页而不是官网
```

### 7.3 注意

1. 降权不等于删除。
2. 全局 EXCLUDE_DOMAINS 可以删除，但建议只删除明显不可能作为官网的域名。
3. 社媒结果默认不作为官网候选，但可放进 metadata，用于后续品牌验证。
4. Source score 不替代 detector score，也不替代 ICP score。

---

## 8. Pipeline 改造点

当前 pipeline 中逻辑类似：

```ts
const queries = buildDiscoveryQueries(...);
for (const query of queries) {
  const searchResults = await searchCompany(query, ...);
  const detectorResult = await detectOfficialWebsite(query, searchResults, ...);
}
```

改为：

```ts
const expandedQueries = buildDiscoveryQueries(...);
const searchResults = await searchDiscoverySources({
  queries: expandedQueries,
  targetLimit: context.job.targetLimit,
  country: context.job.country,
});
const detectorResult = await detectOfficialWebsite("multi-source", searchResults, config);
```

或者按 queryIntent 分批 detector，但必须保证：

```text
candidate.metadata.searchSources
candidate.metadata.queryIntent
candidate.metadata.sourceProvider
candidate.metadata.sourceQualityScore
```

被保存到 `lead_discovery_candidates.metadata`。

---

## 9. 精准性验证体系

### 9.1 Golden Set 示例文件

新增：`data/eval/icp-golden-set.example.json`

结构：

```json
[
  {
    "icpName": "RTA Furniture DTC Brands",
    "icpProfile": {
      "industry": "furniture",
      "mustHave": ["brand", "DTC", "consumer self-assembly"],
      "mustNotHave": ["manufacturer", "factory", "supplier"],
      "positiveKeywords": ["RTA", "flat-pack", "ready-to-assemble", "modular", "easy assembly"],
      "negativeKeywords": ["OEM", "factory direct", "wholesale only"],
      "productCategories": ["RTA furniture", "flat-pack furniture", "modular furniture"],
      "salesModel": "DTC",
      "minScoreToSave": 80,
      "minScoreToReview": 60
    },
    "queries": [
      "RTA furniture brand United States official site",
      "flat-pack furniture DTC brand United States",
      "modular furniture home brand store"
    ],
    "samples": [
      {
        "url": "https://example-brand.com",
        "label": "target",
        "reason": "Brand site selling modular / flat-pack furniture directly to consumers"
      },
      {
        "url": "https://example-factory.com",
        "label": "non_target",
        "reason": "Manufacturer / supplier, not a target brand customer"
      }
    ]
  }
]
```

注意：示例 URL 可以是假数据，真实 eval 文件可以本地维护，不一定提交真实客户名单。

### 9.2 Search Eval 脚本

新增：`scripts/eval-discovery-search.ts`

功能：

```text
1. 读取 golden set
2. 对每个 ICP 生成 expanded queries
3. 调用 searchDiscoverySources
4. 输出搜索召回报告
```

指标：

```text
Total Results
Unique Root Domains
Duplicate Rate
Official Site Rate
Marketplace Pollution Rate
Directory Pollution Rate
Social Only Rate
Query Intent Contribution
Top 20 Results
```

如果 golden set 有人工 label，则输出：

```text
Recall@50
Precision@20
False Positive Examples
False Negative Examples
```

### 9.3 ICP Classifier Eval 脚本

新增：`scripts/eval-icp-classifier.ts`

功能：

```text
1. 读取 golden set samples
2. 抓取页面或使用预存文本
3. 跑 rule-filter + AI classifier + scoring
4. 对比人工 label
5. 输出分类报告
```

指标：

```text
Accepted Precision
Rejected Accuracy
Needs Review Rate
False Positive Rate
False Negative Rate
Top Error Reasons
```

### 9.4 package.json scripts

新增：

```json
{
  "eval:discovery-search": "tsx scripts/eval-discovery-search.ts",
  "eval:icp-classifier": "tsx scripts/eval-icp-classifier.ts"
}
```

---

## 10. 验收标准

### 10.1 功能验收

必须满足：

```text
[ ] pipeline 不再直接依赖 searchCompany 单一函数
[ ] 新增 searchDiscoverySources
[ ] 新增 DiscoverySearchProvider 接口
[ ] SearXNG 已作为 provider 接入
[ ] query-expander 返回带 intent 的 expanded queries
[ ] candidate metadata 保存 sourceProvider / queryIntent / query / sourceQualityScore
[ ] 搜索结果按 rootDomain 去重
[ ] 单 provider 失败不会导致整个 job 失败
[ ] Eval 示例数据已添加
[ ] Eval 脚本可以运行
[ ] package.json 添加 eval scripts
```

### 10.2 质量验收

在至少 1 个示例 ICP 上，本地 eval 输出应包含：

```text
Precision@20
Official Site Rate
Marketplace Pollution Rate
False Positive Examples
False Negative Examples
Query Intent Contribution
```

### 10.3 非目标

本次不要求：

```text
[ ] 接入所有搜索 API
[ ] 实现完整社媒抓取
[ ] 实现机器学习排序模型
[ ] 实现自动 Prompt 优化
[ ] 实现全自动无人工审核入库
```

---

## 11. 推荐执行顺序

### Step 1：抽象搜索类型和 provider

新增：

```text
lib/discovery/search/types.ts
lib/discovery/search/providers/searxng.provider.ts
lib/discovery/search/providers/index.ts
```

### Step 2：改造 query-expander

从 `string[]` 改为 `DiscoveryExpandedQuery[]`。

保留旧函数兼容也可以：

```ts
export function buildDiscoveryQueryStrings(...) {
  return buildDiscoveryQueries(...).map((item) => item.query);
}
```

### Step 3：新增 search-orchestrator

实现 provider 调用、合并、去重、source scoring。

### Step 4：改 pipeline

用 `searchDiscoverySources` 替换直接 `searchCompany`。

### Step 5：保存 metadata

在 candidate metadata 中保存：

```ts
{
  searchSources: [...],
  sourceProvider,
  queryIntent,
  sourceQualityScore,
}
```

### Step 6：新增 eval 脚本

优先保证能输出报告，不要求第一版特别完美。

---

## 12. 关键判断原则

本次改造要解决的是：

```text
不要只让系统“更会筛选”，还要让系统“更会召回”。
```

最终产品体验目标：

```text
用户定义 ICP -> 系统从多个搜索意图召回候选 -> 优先抓取更像目标客户官网的结果 -> ICP 判断 -> 候选池审核 -> 用户反馈继续影响下次发现
```

早期不要追求 100% 自动化。更合理的目标是：

```text
Precision@20 >= 70%
自动 accepted precision >= 80%
False positive <= 20%
高风险候选进入 needs_review，而不是直接入库
```

---

## 13. 需要特别注意的现有问题

### 13.1 SearXNG 命名问题

当前文件名 `lib/integrations/serpapi.ts` 实际使用 SearXNG，语义容易误导。

建议：

```text
保留旧文件兼容，但新增 searxng provider；后续逐步迁移。
```

### 13.2 Worker 生产环境问题

如果 production worker 依赖 `ENABLE_WORKERS=true`，确保 `.env.production.example` 和部署文档包含：

```env
ENABLE_WORKERS=true
```

否则 Discovery Job 可能入队但不消费。

### 13.3 Search 与 ICP 判断的边界

Search 阶段只负责召回和轻量排序，不要在 search 阶段做最终 ICP 判定。

最终是否 accepted / rejected 仍应由：

```text
detector + rule-filter + AI classifier + feedback + scoring
```

共同决定。
