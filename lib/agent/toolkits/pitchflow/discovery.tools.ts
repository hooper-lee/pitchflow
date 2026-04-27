import { z } from "zod";
import {
  getDiscoveryJob,
  listDiscoveryCandidates,
  listDiscoveryJobs,
} from "@/lib/services/discovery.service";
import { truncateText } from "@/lib/agent/toolkits/pitchflow/format";
import type { AgentTool } from "@/lib/agent/types";

const discoveryJobsSchema = z.object({
  status: z
    .enum(["pending", "searching", "crawling", "filtering", "scoring", "reviewing", "completed", "failed", "cancelled"])
    .optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

const discoveryCandidatesSchema = z.object({
  jobId: z.string().uuid(),
  decision: z.enum(["pending", "accepted", "rejected", "needs_review", "blacklisted", "saved"]).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

async function listDiscoveryJobsTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const input = discoveryJobsSchema.parse(rawInput);
  const result = await listDiscoveryJobs(context.tenantId, {
    page: 1,
    limit: input.limit,
    status: input.status,
  });

  return {
    jobs: result.items.map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      progress: job.progress,
      candidateCount: job.candidateCount,
      savedCount: job.savedCount,
      errorMessage: truncateText(job.errorMessage, 120),
    })),
    summary:
      result.total > 0
        ? `找到 ${result.total} 个精准挖掘任务，最近 ${result.items.length} 个已列出。`
        : "当前还没有精准挖掘任务。",
  };
}

async function summarizeDiscoveryCandidatesTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const input = discoveryCandidatesSchema.parse(rawInput);
  const [job, candidates] = await Promise.all([
    getDiscoveryJob(input.jobId, context.tenantId),
    listDiscoveryCandidates(context.tenantId, input.jobId, {
      page: 1,
      limit: input.limit,
      decision: input.decision,
      minScore: input.minScore,
    }),
  ]);

  return {
    job: job ? { id: job.id, name: job.name, status: job.status, progress: job.progress } : null,
    candidates: candidates.items.map((candidate) => ({
      id: candidate.id,
      companyName: candidate.companyName,
      domain: candidate.domain,
      finalScore: candidate.finalScore,
      decision: candidate.decision,
      snippet: truncateText(candidate.snippet, 120),
    })),
    summary: job
      ? `${job.name} 当前状态 ${job.status}，候选共 ${candidates.total} 个。`
      : "没有找到该挖掘任务。",
  };
}

export const discoveryTools: AgentTool[] = [
  {
    name: "pitchflow.discovery.list_jobs",
    toolkit: "pitchflow.discovery",
    description: "查看精准挖掘任务列表。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: discoveryJobsSchema,
    execute: listDiscoveryJobsTool,
  },
  {
    name: "pitchflow.discovery.summarize_candidates",
    toolkit: "pitchflow.discovery",
    description: "总结某个精准挖掘任务的候选池。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: discoveryCandidatesSchema,
    execute: summarizeDiscoveryCandidatesTool,
  },
];
