import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { researchProspect } from "@/lib/services/research.service";
import type { ResearchJobData } from "../jobs/research.job";

export async function processResearchJob(job: Job<ResearchJobData>) {
  const { prospectId, tenantId, aiProvider } = job.data;
  const summary = await researchProspect(prospectId, tenantId, aiProvider);
  console.log(`Research completed for prospect ${prospectId}`);
  return { prospectId, summaryLength: summary.length };
}

if (process.env.NODE_ENV !== "production" || process.env.ENABLE_WORKERS === "true") {
  const connection = getRedisConnection();
  const worker = new Worker("prospect-research", processResearchJob, {
    connection,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`Research job done: ${job.data.prospectId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Research job failed: ${job?.data?.prospectId}`, err);
  });
}
