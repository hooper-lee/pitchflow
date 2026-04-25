import { readFile } from "node:fs/promises";
import path from "node:path";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  evaluateGoldenSetAB,
  type GoldenSet,
  type IcpEvalMetrics,
} from "@/lib/discovery/eval/icp-classifier-eval";
import { getRootDomain } from "@/lib/discovery/normalize";
import { buildDiscoveryQueries } from "@/lib/discovery/query-expander";
import { runRuleFilter } from "@/lib/discovery/rule-filter";
import { searchDiscoverySources } from "@/lib/discovery/search/search-orchestrator";
import type {
  DiscoveryIcpProfile,
  DiscoveryJobRecord,
  DiscoveryRuleFilterResult,
} from "@/lib/discovery/types";
import type { DiscoverySearchResult } from "@/lib/discovery/search/types";

export const dynamic = "force-dynamic";

const GOLDEN_SET_PATH = "data/eval/icp-golden-set.example.json";

type AdminGoldenSet = GoldenSet & { queries?: string[] };

export default async function AdminDiscoveryEvalsPage() {
  const goldenSets = await loadGoldenSets();
  const reports = goldenSets.map(evaluateGoldenSetAB);
  const totals = summarizeGoldenSets(goldenSets);
  const liveSample = await loadLiveSearchSample(goldenSets[0]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">挖掘评测</h1>
          <p className="page-subtitle">
            用人工标注样本和真实搜索抽样一起检查客户挖掘质量。评测只用于观察规则效果，不会影响真实客户数据。
          </p>
        </div>
        <Badge variant="outline" className="rounded-full px-4 py-2">
          当前线上默认：{process.env.DISCOVERY_RULE_VARIANT === "A" ? "A" : "B"}
        </Badge>
      </div>

      <div className="metric-grid md:grid-cols-4">
        <MetricCard title="ICP 数" value={String(totals.icpCount)} />
        <MetricCard title="人工标注样本" value={String(totals.sampleCount)} />
        <MetricCard title="目标客户样本" value={String(totals.targetCount)} />
        <MetricCard title="灰区样本" value={String(totals.uncertainCount)} />
      </div>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>Golden Set 人工标注 A/B 评测</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <p>
              这块是最重要的离线评测：先用人工给样本标注 target / non_target / uncertain，再分别用 A 规则和 B 规则跑一遍，比较系统判断和人工标签是否一致。
            </p>
            <p>
              Precision 表示系统判为目标客户时有多准；Recall 表示人工标注的目标客户被找回多少；灰区准确率表示 uncertain 样本有没有被正确留给人工复核。
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ICP</TableHead>
                <TableHead>A 目标准确率</TableHead>
                <TableHead>B 目标准确率</TableHead>
                <TableHead>A 目标召回率</TableHead>
                <TableHead>B 目标召回率</TableHead>
                <TableHead>A 灰区准确率</TableHead>
                <TableHead>B 灰区准确率</TableHead>
                <TableHead>结论</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.name}>
                  <TableCell className="font-medium">{report.name}</TableCell>
                  <MetricCell value={report.variants.A.acceptedPrecision} />
                  <MetricCell value={report.variants.B.acceptedPrecision} />
                  <MetricCell value={report.variants.A.recall} />
                  <MetricCell value={report.variants.B.recall} />
                  <MetricCell value={report.variants.A.uncertainAccuracy} />
                  <MetricCell value={report.variants.B.uncertainAccuracy} />
                  <TableCell>{renderConclusion(report.variants.A, report.variants.B)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>真实搜索源 Metadata 抽样</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <p>
              这块直接请求真实搜索源，展示当前搜索编排拿到的 Top 结果，用来检查搜索来源字段是否真实产出。
            </p>
            <p>
              重点看来源、Intent、质量分、命中查询数。这里没有人工标签，所以不能直接代表准确率，只能说明搜索编排和 metadata 是否正常。
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>sourceProvider</TableHead>
                <TableHead>queryIntent</TableHead>
                <TableHead>sourceQualityScore</TableHead>
                <TableHead>命中查询数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveSample.results.map((result) => (
                <TableRow key={result.link}>
                  <TableCell className="max-w-[420px] truncate font-medium">{result.title}</TableCell>
                  <TableCell>{result.sourceProvider}</TableCell>
                  <TableCell>{result.queryIntent}</TableCell>
                  <TableCell>{result.metadata?.sourceQualityScore ?? "-"}</TableCell>
                  <TableCell>{getSearchSourceCount(result)}</TableCell>
                </TableRow>
              ))}
              {liveSample.results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    {liveSample.error || "当前搜索源没有返回结果"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>真实搜索 Top 结果规则 A/B 判定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <p>
              这块把同一批真实搜索结果分别交给 A 规则和 B 规则判断，观察两套规则对真实结果的判定差异。
            </p>
            <p>
              因为这些真实搜索结果没有人工标注，所以这里不能算 Precision / Recall，只能辅助检查 B 规则是否更保守、是否把可疑结果放到待复核。
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>A 判定</TableHead>
                <TableHead>A 分</TableHead>
                <TableHead>B 判定</TableHead>
                <TableHead>B 分</TableHead>
                <TableHead>差异</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveSample.abComparisons.map((comparison) => (
                <TableRow key={comparison.link}>
                  <TableCell className="max-w-[360px] truncate font-medium">{comparison.title}</TableCell>
                  <TableCell>{renderDecisionBadge(comparison.variantA.decision)}</TableCell>
                  <TableCell>{comparison.variantA.ruleScore}</TableCell>
                  <TableCell>{renderDecisionBadge(comparison.variantB.decision)}</TableCell>
                  <TableCell>{comparison.variantB.ruleScore}</TableCell>
                  <TableCell>{comparison.changed ? "有变化" : "一致"}</TableCell>
                </TableRow>
              ))}
              {liveSample.abComparisons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    {liveSample.error || "当前没有可对比的真实搜索结果"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>查询扩展与 Intent 编排</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <p>
              这块展示系统根据 ICP 画像生成的搜索查询词，以及每个查询词的意图类型和优先级。
            </p>
            <p>
              queryIntent 用于区分产品词、品牌词、DTC、官网、平台等搜索方向，后续会影响来源质量评分和候选排序。
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>查询词</TableHead>
                <TableHead>queryIntent</TableHead>
                <TableHead>优先级</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveSample.queries.map((query) => (
                <TableRow key={`${query.intent}-${query.query}`}>
                  <TableCell>{query.query}</TableCell>
                  <TableCell>{query.intent}</TableCell>
                  <TableCell>{query.priority}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>页面说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-500">
          <p>Golden Set 读取的是仓库内示例数据：{GOLDEN_SET_PATH}。</p>
          <p>真实客户标注数据后续建议进入数据库或私有上传，不建议直接放进代码仓库。</p>
          <p>离线 A/B 命令：npm run eval:icp-ab。真实搜索抽样命令：npm run eval:discovery-search。</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function loadLiveSearchSample(goldenSet: AdminGoldenSet | undefined) {
  if (!goldenSet) {
    return { queries: [], results: [], abComparisons: [], error: "Golden Set 不存在" };
  }

  try {
    const icpProfile = buildEvalIcpProfile(goldenSet);
    const job = buildEvalJob(goldenSet);
    const queries = buildDiscoveryQueries(job, icpProfile).slice(0, 4);
    const results = await searchDiscoverySources({
      queries,
      targetLimit: 5,
      country: job.country,
      icpProfile,
    });
    const sampleResults = results.slice(0, 8);

    return {
      queries,
      results: sampleResults,
      abComparisons: sampleResults.map((result) => compareLiveResult(result, icpProfile)),
      error: "",
    };
  } catch (error) {
    return {
      queries: [],
      results: [],
      abComparisons: [],
      error: error instanceof Error ? error.message : "真实搜索源测试失败",
    };
  }
}

function compareLiveResult(result: DiscoverySearchResult, icpProfile: DiscoveryIcpProfile) {
  const variantA = classifyLiveResult(result, icpProfile, "A");
  const variantB = classifyLiveResult(result, icpProfile, "B");
  return {
    title: result.title,
    link: result.link,
    variantA,
    variantB,
    changed: variantA.decision !== variantB.decision || variantA.ruleScore !== variantB.ruleScore,
  };
}

function classifyLiveResult(
  result: DiscoverySearchResult,
  icpProfile: DiscoveryIcpProfile,
  ruleVariant: "A" | "B"
) {
  const ruleResult = runRuleFilter({
    candidate: {
      title: result.title,
      snippet: result.snippet,
      companyName: result.title,
      domain: getDomain(result.link),
      rootDomain: getRootDomain(result.link) || getDomain(result.link),
      rawText: `${result.title}\n${result.snippet}`,
      pagesFetched: [{ type: "homepage", url: result.link, text: result.snippet }],
    },
    icpProfile,
    ruleVariant,
  });

  return {
    ruleScore: ruleResult.ruleScore,
    decision: resolveRuleDecision(ruleResult, icpProfile),
  };
}

function resolveRuleDecision(
  ruleResult: DiscoveryRuleFilterResult,
  icpProfile: DiscoveryIcpProfile
) {
  if (ruleResult.hardReject) return "排除";
  if (ruleResult.ruleScore >= icpProfile.minScoreToSave) return "通过";
  if (ruleResult.ruleScore >= icpProfile.minScoreToReview) return "待复核";
  return "排除";
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildEvalIcpProfile(goldenSet: AdminGoldenSet): DiscoveryIcpProfile {
  const profile = goldenSet.icpProfile;
  return {
    id: "eval",
    tenantId: "eval",
    name: goldenSet.icpName,
    industry: profile.industry || null,
    targetCustomerText: profile.targetCustomerText || null,
    mustHave: profile.mustHave || [],
    mustNotHave: profile.mustNotHave || [],
    positiveKeywords: profile.positiveKeywords || [],
    negativeKeywords: profile.negativeKeywords || [],
    productCategories: profile.productCategories || [],
    salesModel: profile.salesModel || null,
    scoreWeights: profile.scoreWeights || {},
    minScoreToSave: profile.minScoreToSave || 80,
    minScoreToReview: profile.minScoreToReview || 60,
  };
}

function buildEvalJob(goldenSet: AdminGoldenSet): DiscoveryJobRecord {
  return {
    id: "eval",
    tenantId: "eval",
    name: goldenSet.icpName,
    status: "pending",
    industry: goldenSet.icpProfile.industry || null,
    country: "United States",
    keywords: goldenSet.queries || [],
    inputQuery: goldenSet.icpProfile.targetCustomerText || goldenSet.icpName,
    filters: {},
    targetLimit: 5,
    searchedCount: 0,
    crawledCount: 0,
    candidateCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    savedCount: 0,
    progress: 0,
  };
}

function getSearchSourceCount(result: DiscoverySearchResult) {
  const sources = result.metadata?.sources;
  return Array.isArray(sources) ? sources.length : 0;
}

async function loadGoldenSets(): Promise<AdminGoldenSet[]> {
  const filePath = path.join(process.cwd(), GOLDEN_SET_PATH);
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as AdminGoldenSet[];
}

function summarizeGoldenSets(goldenSets: AdminGoldenSet[]) {
  const samples = goldenSets.flatMap((goldenSet) => goldenSet.samples || []);
  return {
    icpCount: goldenSets.length,
    sampleCount: samples.length,
    targetCount: samples.filter((sample) => sample.label === "target").length,
    uncertainCount: samples.filter((sample) => sample.label === "uncertain").length,
  };
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="section-card">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</p>
        <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function MetricCell({ value }: { value: number }) {
  return <TableCell>{Math.round(value * 100)}%</TableCell>;
}

function renderConclusion(metricsA: IcpEvalMetrics, metricsB: IcpEvalMetrics) {
  if (metricsB.uncertainAccuracy > metricsA.uncertainAccuracy) {
    return <Badge className="rounded-full">B 更稳</Badge>;
  }
  if (metricsB.acceptedPrecision < metricsA.acceptedPrecision) {
    return <Badge variant="destructive" className="rounded-full">B 需复核</Badge>;
  }
  return <Badge variant="outline" className="rounded-full">持平</Badge>;
}

function renderDecisionBadge(decision: string) {
  if (decision === "通过") return <Badge className="rounded-full">通过</Badge>;
  if (decision === "待复核") return <Badge variant="outline" className="rounded-full">待复核</Badge>;
  return <Badge variant="secondary" className="rounded-full">排除</Badge>;
}
