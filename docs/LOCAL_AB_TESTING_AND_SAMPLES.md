# PitchFlow 本地 A/B 测试逻辑与样本说明

> 本文档用于指导本地评测、Codex 后续开发和人工标注。目标是在 Agent / 自动化能力放大之前，建立稳定的客户挖掘准确性、召回率、搜索污染控制和邮件模板准确性评测体系。

## 1. 背景与目标

PitchFlow 的核心业务链路是：

```text
输入行业 / ICP / 关键词
  -> 搜索与查询扩展
  -> 官网识别与去重
  -> ICP 规则筛选
  -> AI 分类 / 评分
  -> 候选池
  -> 客户入库
  -> 邮件模板 / 个性化邮件生成
  -> 活动发送 / 跟进
```

如果客户挖掘结果不准，Agent 会更快地产生错误候选；如果邮件模板不稳定，Agent 会更快地放大发信风险。

因此在推进 Hemera Cloud Agent Platform 之前或同步过程中，需要建立本地 A/B 测试体系，重点验证：

```text
1. 搜索阶段能否找到足够多的真实目标客户
2. 搜索结果中 marketplace / directory / social / media 污染是否可控
3. ICP 规则和分类是否准确
4. 候选入库阈值是否合理
5. 邮件模板是否准确、自然、低幻觉、低垃圾邮件风险
6. 不同行业和不同 ICP 下结果是否稳定
```

## 2. 当前已有评测基础

当前项目已有以下脚本：

```bash
npm run eval:icp-ab
npm run eval:discovery-search
```

### 2.1 `eval:icp-ab`

用途：基于 Golden Set 对 ICP 分类规则做 A/B 对比。

默认样本路径：

```text
data/eval/icp-golden-set.example.json
```

已覆盖指标：

```text
acceptedPrecision    接受结果准确率
recall               召回率
rejectedAccuracy     拒绝准确率
uncertainRate        不确定率
uncertainAccuracy    不确定样本准确率
falsePositiveRate    误收率
falseNegativeRate    漏召率
topErrorCategories   错误类型统计
```

### 2.2 `eval:discovery-search`

用途：验证真实搜索和查询扩展质量。

已覆盖指标：

```text
totalResults
uniqueRootDomains
duplicateRate
officialSiteRate
marketplacePollutionRate
directoryPollutionRate
socialOnlyRate
precisionAt20
recallAt50
queryIntentContribution
topErrorCategories
```

## 3. 本地 A/B 测试总体设计

A/B 测试分为两条主线：

```text
A. 客户挖掘 A/B
B. 邮件模板 / 邮件生成 A/B
```

### 3.1 客户挖掘 A/B

验证对象：

```text
query expansion
search source scoring
official site detector
rule filter
AI classifier
candidate final scoring
save threshold
review threshold
```

核心问题：

```text
是否能找到目标客户？
目标客户是否排在前面？
污染结果是否被压低？
非目标客户是否被拒绝？
高分候选是否真的值得入库？
```

### 3.2 邮件模板 / 邮件生成 A/B

验证对象：

```text
邮件 Prompt
开发信模板
跟进邮件模板
已回复客户推进模板
产品资料插值
客户调研信息引用
邮件 QA checker
```

核心问题：

```text
是否编造客户信息？
是否准确引用产品卖点？
是否符合目标客户场景？
是否过度营销或像垃圾邮件？
CTA 是否清晰？
语气是否自然？
是否需要人工审核？
```

## 4. 行业测试范围

为了避免只在单一行业过拟合，本地评测集必须覆盖多个外贸常见行业。

第一批建议覆盖至少 16 个行业，每个行业至少 1 个主 ICP。

| 行业 | 目标客户示例 | 常见污染来源 | 邮件测试重点 |
|---|---|---|---|
| 宠物用品 | DTC 宠物品牌、宠物用品进口商 | Amazon、Chewy 列表、宠物博客 | 避免编造宠物品类和渠道 |
| 家居用品 | 家居品牌、家居进口商、生活方式电商 | Wayfair、Houzz、目录站 | 强调设计、MOQ、定制能力 |
| 户外用品 | 户外装备品牌、露营用品品牌 | REI、测评媒体、论坛 | 区分品牌方与零售商 |
| 美妆个护 | DTC 美妆品牌、个护进口商 | Sephora、Ulta、测评博客 | 注意合规，不夸大功效 |
| 服装配饰 | 服装品牌、运动服饰品牌、帽包品牌 | Marketplace、时尚媒体 | 强调打样、面料、OEM/ODM |
| 母婴用品 | 婴童用品品牌、母婴零售商 | Amazon、育儿博客 | 避免安全/认证虚假声明 |
| 电子配件 | 手机配件品牌、消费电子品牌 | BestBuy、Walmart、测评站 | 强调认证和质量但不编造 |
| 汽车后市场 | 汽配品牌、改装件品牌、批发商 | AutoZone、论坛、目录站 | 区分品牌、经销商和修理厂 |
| 包装材料 | 食品包装品牌、环保包装采购商 | Alibaba、Thomasnet、目录站 | B2B 语气，强调产能和合规 |
| 食品饮料 | 茶饮品牌、咖啡品牌、健康食品品牌 | 餐厅、媒体、Marketplace | 避免健康功效和监管风险 |
| 家具 | 家具品牌、办公家具采购商 | Houzz、Wayfair、室内设计文章 | 强调材料、定制、交付能力 |
| 健身用品 | 健身器材品牌、运动康复品牌 | 健身房、博客、Amazon | 区分品牌方与内容站 |
| 礼品促销品 | 企业礼品商、促销品分销商 | 礼品目录、展会列表 | 强调定制、Logo、交付周期 |
| 工业零部件 | 机械零件采购商、设备商 | B2B 目录、Thomasnet | 更正式，强调规格和稳定供应 |
| 医疗健康用品 | 医疗耗材采购商、健康用品品牌 | 医疗信息站、医院、监管页面 | 严禁编造认证和功效声明 |
| 园艺用品 | 园艺品牌、花园工具品牌 | 家装零售商、博客、Pinterest | 区分零售渠道和品牌官网 |

> 注：医疗健康、母婴、美妆等行业涉及更高合规风险，邮件 QA 阈值应更高，不能编造认证、功效、安全承诺。

## 5. 样本规模建议

### 5.1 每个行业最小样本量

每个行业建议至少：

```text
Target: 60
Non-target: 60
Uncertain: 20
Total: 140
```

16 个行业合计：

```text
Target: 960
Non-target: 960
Uncertain: 320
Total: 2240
```

这是较完整的第一阶段行业覆盖。

### 5.2 快速启动版样本量

如果短期无法一次性标注 2240 条，可以先做：

```text
每个行业：
Target: 20
Non-target: 20
Uncertain: 10
Total: 50

16 个行业合计：800 条
```

快速启动版用于初始 A/B；正式版本逐步扩充到 2240 条以上。

### 5.3 每个行业样本来源构成

Target 样本应包含：

```text
真实品牌官网
真实 DTC 官网
真实 B2B 采购商官网
真实进口商 / 分销商官网
有联系邮箱或联系表单的网站
```

Non-target 样本应包含：

```text
Marketplace 商品页
电商平台搜索结果页
行业目录页
媒体文章
博客文章
社交主页
论坛帖子
招聘页
政府 / 协会页面
纯零售渠道页
无关行业官网
```

Uncertain 样本应包含：

```text
信息不足的官网
品牌和零售身份不明确的网站
多行业集团网站
仅有社交页面但无官网
疑似贸易商但证据不足
```

## 6. Golden Set 文件结构

建议新增目录：

```text
data/eval/golden-sets/
  discovery/
    pet-supplies-us-dtc.json
    home-goods-us-brands.json
    outdoor-gear-eu-brands.json
    beauty-personal-care-us-dtc.json
    apparel-accessories-us-brands.json
    baby-products-us-brands.json
    electronics-accessories-us-brands.json
    auto-aftermarket-us-brands.json
    packaging-b2b-us-buyers.json
    food-beverage-us-brands.json
    furniture-us-brands.json
    fitness-equipment-us-brands.json
    promotional-gifts-us-distributors.json
    industrial-parts-us-buyers.json
    healthcare-supplies-us-buyers.json
    gardening-supplies-us-brands.json

  email/
    cold-outreach-pet-supplies.json
    cold-outreach-home-goods.json
    cold-outreach-outdoor-gear.json
    reply-followup-general.json
    no-reply-followup-general.json
```

### 6.1 Discovery Golden Set 示例

```json
{
  "icpName": "US Pet Supplies DTC Brands",
  "industry": "Pet Supplies",
  "country": "United States",
  "queries": [
    "dog harness brand",
    "pet supplies DTC brand",
    "cat products official site"
  ],
  "icpProfile": {
    "industry": "Pet Supplies",
    "targetCustomerText": "US-based direct-to-consumer pet supplies brands with official ecommerce websites and clear pet product lines.",
    "mustHave": ["pet products", "dog", "cat", "shop", "brand"],
    "mustNotHave": ["marketplace", "directory", "blog only", "media article"],
    "positiveKeywords": ["pet supplies", "dog harness", "cat toys", "pet accessories", "DTC"],
    "negativeKeywords": ["Amazon", "Walmart", "directory", "review blog", "forum"],
    "productCategories": ["pet supplies", "pet accessories"],
    "salesModel": "dtc",
    "minScoreToSave": 80,
    "minScoreToReview": 60
  },
  "samples": [
    {
      "url": "https://example-pet-brand.com",
      "label": "target",
      "reason": "Official DTC pet accessories brand website with ecommerce store and contact page.",
      "text": "Example Pet Brand sells dog harnesses, leashes, collars, and pet accessories through its official online store."
    },
    {
      "url": "https://amazon.com/example-pet-product",
      "label": "non_target",
      "reason": "Marketplace product listing, not an official brand website.",
      "text": "Amazon product listing for a dog harness."
    },
    {
      "url": "https://instagram.com/examplepetbrand",
      "label": "uncertain",
      "reason": "Social profile only. It may be a brand, but no official website content is available.",
      "text": "Instagram page for a pet brand."
    }
  ]
}
```

## 7. Discovery A/B 测试逻辑

### 7.1 规则分类 A/B

当前可使用：

```bash
npm run eval:icp-ab
```

或指定样本：

```bash
npm run eval:icp-ab -- data/eval/golden-sets/discovery/pet-supplies-us-dtc.json
```

目标：比较规则 Variant A / B 对同一批样本的表现。

指标：

```text
acceptedPrecision
recall
rejectedAccuracy
uncertainRate
falsePositiveRate
falseNegativeRate
falsePositiveExamples
falseNegativeExamples
topErrorCategories
```

### 7.2 真实搜索 A/B

当前可使用：

```bash
npm run eval:discovery-search
```

或指定样本：

```bash
npm run eval:discovery-search -- data/eval/golden-sets/discovery/pet-supplies-us-dtc.json
```

目标：验证查询扩展和搜索结果质量。

指标：

```text
precisionAt20
recallAt50
officialSiteRate
marketplacePollutionRate
directoryPollutionRate
socialOnlyRate
duplicateRate
queryIntentContribution
topErrorCategories
```

### 7.3 推荐上线阈值

客户挖掘正式给 Agent 自动化使用前，建议最低阈值：

```text
acceptedPrecision >= 0.75
recall >= 0.55
falsePositiveRate <= 0.20
falseNegativeRate <= 0.35
uncertainRate <= 0.30
```

真实搜索建议阈值：

```text
precisionAt20 >= 0.50
officialSiteRate >= 0.60
marketplacePollutionRate <= 0.20
directoryPollutionRate <= 0.20
socialOnlyRate <= 0.15
duplicateRate <= 0.25
```

高风险行业建议更高阈值：

```text
healthcare / baby / beauty:
acceptedPrecision >= 0.85
falsePositiveRate <= 0.12
```

## 8. Discovery 错误分类规范

所有 false positive / false negative 需要归因。

### 8.1 False Positive 类型

```text
marketplace_pollution
  Marketplace 页面被误认为目标客户

directory_pollution
  目录站 / Yellow pages / B2B directory 被误收

social_only
  只有 LinkedIn / Facebook / Instagram 等社交页面

media_or_article
  新闻、博客、测评文章被误收

retailer_not_brand
  零售商或渠道商被误认为品牌方

wrong_industry
  行业不匹配

weak_negative_filter
  负向关键词不足

fake_official_site
  像官网但不是目标客户
```

### 8.2 False Negative 类型

```text
missing_positive_signal
  目标客户文本中正向信号不足

query_miss
  查询词未覆盖该类客户

strict_must_have
  mustHave 规则过严

score_threshold_too_high
  阈值过高导致漏召

content_extraction_failed
  页面抓取文本不足

ai_classifier_missed
  AI 分类漏判
```

## 9. 邮件 A/B 测试范围

邮件测试必须覆盖：

```text
首封冷启动开发信
未回复自动跟进
已回复客户推进
高意向客户回复
低意向客户回复
询价回复
退订 / 拒绝回复
自动回复 / out of office
```

### 9.1 邮件测试行业覆盖

优先覆盖与 Discovery 相同的 16 个行业：

```text
宠物用品
家居用品
户外用品
美妆个护
服装配饰
母婴用品
电子配件
汽车后市场
包装材料
食品饮料
家具
健身用品
礼品促销品
工业零部件
医疗健康用品
园艺用品
```

每个行业至少准备：

```text
首封开发信样本：10
未回复跟进样本：5
已回复推进样本：5
```

16 个行业合计：

```text
首封开发信：160
未回复跟进：80
已回复推进：80
总计：320
```

## 10. Email Golden Set 文件结构

### 10.1 首封开发信样本

```json
{
  "name": "Cold Outreach - Pet Supplies",
  "industry": "Pet Supplies",
  "campaignType": "cold_outreach",
  "variantA": {
    "promptKey": "EMAIL_OUTREACH_USER_A",
    "templateName": "Pet Supplies Short Value Prop A"
  },
  "variantB": {
    "promptKey": "EMAIL_OUTREACH_USER_B",
    "templateName": "Pet Supplies Evidence-led B"
  },
  "samples": [
    {
      "id": "pet-cold-001",
      "prospect": {
        "companyName": "PawTrail Co.",
        "contactName": "Sarah",
        "industry": "Pet Supplies",
        "country": "United States",
        "website": "https://pawtrail.example",
        "researchSummary": "DTC pet accessories brand focused on dog walking gear and outdoor pet products."
      },
      "productProfile": {
        "companyName": "ACME Pet Manufacturing",
        "productName": "OEM pet harness and leash sets",
        "productDescription": "Custom pet harness, leash, and collar manufacturing for pet brands.",
        "valueProposition": "Low MOQ, OEM customization, fast sampling, stable export quality.",
        "senderName": "Alex",
        "senderTitle": "Sales Manager"
      },
      "expectedMustInclude": [
        "pet",
        "harness",
        "custom",
        "low MOQ"
      ],
      "mustNotInclude": [
        "cat food",
        "FDA approved",
        "founded in 1998",
        "Walmart supplier"
      ],
      "expectedTone": "concise, professional, helpful, non-pushy",
      "maxWords": 160
    }
  ]
}
```

### 10.2 已回复客户推进样本

```json
{
  "name": "Reply Follow-up - General",
  "campaignType": "reply_followup",
  "samples": [
    {
      "id": "reply-001",
      "prospect": {
        "companyName": "TrailPets",
        "contactName": "Megan",
        "industry": "Pet Supplies",
        "country": "United States",
        "researchSummary": "Pet outdoor accessories brand selling dog harnesses and travel bowls."
      },
      "previousEmail": {
        "subject": "Custom pet harness supplier",
        "body": "We help pet brands develop OEM harness and leash sets with low MOQ."
      },
      "reply": {
        "subject": "Re: Custom pet harness supplier",
        "body": "Thanks. Can you share MOQ and sample lead time? We are looking for a new harness supplier."
      },
      "productProfile": {
        "productName": "OEM pet harness and leash sets",
        "valueProposition": "Low MOQ, OEM customization, fast sampling."
      },
      "expectedMustInclude": [
        "MOQ",
        "sample lead time",
        "harness"
      ],
      "mustNotInclude": [
        "guaranteed lowest price",
        "FDA approved",
        "as we discussed on the phone"
      ],
      "requiresHumanReview": true,
      "maxWords": 140
    }
  ]
}
```

## 11. 邮件 QA 指标

每封生成邮件都应输出 QA 结果。

```ts
interface EmailQaResult {
  factualityScore: number;
  personalizationScore: number;
  deliverabilityScore: number;
  spamRiskScore: number;
  toneScore: number;
  ctaClarityScore: number;
  hallucinationRisks: string[];
  missingRequiredElements: string[];
  forbiddenClaims: string[];
  unsafeClaims: string[];
  finalDecision: "pass" | "needs_review" | "block";
}
```

### 11.1 Factuality

检查：

```text
是否编造客户业务
是否编造联系人姓名
是否编造客户痛点
是否编造客户规模
是否编造认证
是否把 A 公司信息写到 B 公司
是否引用不存在的历史沟通
```

### 11.2 Personalization

检查：

```text
是否正确使用公司名
是否正确使用联系人名
是否引用真实行业和产品
是否与客户业务相关
是否不是泛泛模板
```

### 11.3 Deliverability

检查：

```text
是否过长
是否使用夸张营销词
是否过多链接
是否过多感叹号
是否包含垃圾邮件高风险词
是否 CTA 过多
```

### 11.4 Tone

检查：

```text
是否专业
是否自然
是否不过度推销
是否没有压迫感
是否适合 B2B 外贸开发
```

## 12. 邮件上线阈值

### 12.1 首封开发信

```text
factualityScore >= 90
personalizationScore >= 70
deliverabilityScore >= 75
spamRiskScore <= 25
ctaClarityScore >= 75
forbiddenClaims.length = 0
unsafeClaims.length = 0
wordCount <= 160
```

### 12.2 未回复跟进

```text
factualityScore >= 90
spamRiskScore <= 25
wordCount <= 100
不得重复首封主体内容
不得 guilt pressure
CTA 只能有一个
```

### 12.3 已回复客户推进

```text
replyUnderstandingScore >= 90
factualityScore >= 95
unsafeClaims.length = 0
requiresHumanReview = true
wordCount <= 140
```

已回复推进邮件默认进入人工审核，不建议自动发送。

### 12.4 高风险行业

医疗健康、母婴、美妆个护等行业：

```text
factualityScore >= 95
unsafeClaims.length = 0
forbiddenClaims.length = 0
必须人工确认
禁止编造认证 / 功效 / 安全承诺
```

## 13. 推荐新增本地评测脚本

当前已有 Discovery 相关脚本。建议后续新增：

```json
{
  "scripts": {
    "eval:email-template": "tsx scripts/eval-email-template.ts",
    "eval:email-template-ab": "tsx scripts/eval-email-template.ts --ab",
    "eval:email-qa": "tsx scripts/eval-email-qa.ts",
    "eval:all-local": "npm run eval:icp-ab && npm run eval:discovery-search && npm run eval:email-template-ab"
  }
}
```

### 13.1 `eval-email-template.ts`

职责：

```text
读取 email Golden Set
分别用 Variant A / B 生成邮件
运行 Email QA Checker
输出每个样本的分数和错误
汇总行业维度指标
```

### 13.2 `eval-email-qa.ts`

职责：

```text
只对已有邮件内容运行 QA
用于回归测试历史邮件
找出高风险模板或高风险行业
```

## 14. A/B Variant 管理

### 14.1 Discovery Variant

当前已有：

```env
DISCOVERY_RULE_VARIANT=A
DISCOVERY_RULE_VARIANT=B
```

建议扩展：

```env
DISCOVERY_QUERY_VARIANT=A
DISCOVERY_SOURCE_SCORING_VARIANT=A
DISCOVERY_CLASSIFIER_VARIANT=A
DISCOVERY_SAVE_THRESHOLD_VARIANT=A
```

### 14.2 Email Variant

建议增加：

```env
EMAIL_OUTREACH_PROMPT_VARIANT=A
EMAIL_FOLLOWUP_PROMPT_VARIANT=A
EMAIL_REPLY_PROMPT_VARIANT=A
EMAIL_QA_RULE_VARIANT=A
```

## 15. 本地测试流程

### 15.1 准备环境

```bash
npm install
cp .env.example .env.local
npm run db:push
```

如果需要真实搜索：

```bash
docker run -d --name searxng -p 8888:8080 \
  -v $(pwd)/searxng/settings.yml:/etc/searxng/settings.yml \
  searxng/searxng
```

### 15.2 运行 Discovery 规则评测

```bash
npm run eval:icp-ab
```

指定行业：

```bash
npm run eval:icp-ab -- data/eval/golden-sets/discovery/pet-supplies-us-dtc.json
```

### 15.3 运行真实搜索评测

```bash
npm run eval:discovery-search
```

指定行业：

```bash
npm run eval:discovery-search -- data/eval/golden-sets/discovery/pet-supplies-us-dtc.json
```

### 15.4 运行邮件模板 A/B 评测

后续脚本实现后：

```bash
npm run eval:email-template-ab
```

指定行业：

```bash
npm run eval:email-template-ab -- data/eval/golden-sets/email/cold-outreach-pet-supplies.json
```

## 16. 报告输出建议

评测结果建议输出到：

```text
data/eval/reports/
  discovery/
    2026-04-27-icp-ab.json
    2026-04-27-search-ab.json
  email/
    2026-04-27-email-template-ab.json
```

报告应包含：

```text
行业
ICP 名称
样本数量
Variant A 指标
Variant B 指标
差异 delta
失败样本
错误分类
推荐动作
是否通过上线阈值
```

## 17. Agent 自动化权限与评测结果联动

Agent 自动化能力必须受评测结果约束。

建议策略：

```ts
const agentPolicy = {
  allowCreateDiscoveryJob: true,
  allowSingleCandidateSave: true,
  allowBatchCandidateSave: discovery.acceptedPrecision >= 0.85,
  allowAutoCreateCampaignDraft: true,
  allowCampaignStartWithoutConfirmation: false,
  allowSendEmailOnlyIfQaPassed: true,
  requireHumanReviewForReplyFollowup: true
};
```

若某行业评测未达标：

```text
Agent 可以创建挖掘任务
Agent 可以总结候选
Agent 可以推荐入库名单
Agent 不允许自动批量入库
Agent 不允许自动创建并启动活动
Agent 不允许直接发送邮件
```

## 18. 人工标注规范

标注人员必须为每个样本提供：

```text
label: target / non_target / uncertain
reason: 简短原因
errorCategory: 如果是回归样本，需要标注错误类型
text: 页面摘要或抓取文本
```

### 18.1 Target 标准

符合 ICP，并且是：

```text
目标品牌官网
目标采购商官网
目标进口商 / 分销商官网
有明确产品线
有联系方式或联系表单
```

### 18.2 Non-target 标准

不应入库，包括：

```text
Marketplace 页面
目录站
媒体文章
博客
论坛
纯社交主页
无关行业
招聘页
政府/协会页面
纯零售渠道但非目标采购商
```

### 18.3 Uncertain 标准

证据不足或身份不清：

```text
只有社交信息
官网信息太少
公司业务过宽
无法判断是否采购商
无法判断是否目标品类
```

## 19. Codex 后续任务建议

建议分 PR 实现：

```text
PR 1: 扩展 data/eval/golden-sets 目录结构和样例文件
PR 2: 增强 eval:icp-ab 支持批量目录评测
PR 3: 增强 eval:discovery-search 支持批量目录评测和报告输出
PR 4: 新增 email Golden Set schema
PR 5: 新增 email QA checker
PR 6: 新增 eval-email-template.ts
PR 7: 新增 eval:all-local
PR 8: 将评测结果接入 Agent Policy
```

每个 PR 要求：

```text
npm run build 通过
已有 eval 脚本不破坏
报告输出稳定 JSON
样本文件可逐步扩充
```

## 20. 最终目标

本地 A/B 测试体系完成后，应支持：

```text
多行业 Discovery 准确率评测
真实搜索污染率评测
ICP 规则 A/B
查询扩展 A/B
邮件模板 A/B
邮件 QA 风险检测
Agent 自动化权限闸门
```

最终目标不是追求一次性完美，而是建立持续迭代闭环：

```text
真实用户结果
-> 人工标注
-> 加入 Golden Set
-> 本地 A/B
-> 调整规则 / Prompt / 阈值
-> 再评测
-> 达标后开放更多 Agent 自动化能力
```
