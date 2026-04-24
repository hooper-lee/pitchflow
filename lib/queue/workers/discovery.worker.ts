import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leadDiscoveryJobs } from "@/lib/db/schema";
import { runDiscoveryPipeline } from "@/lib/discovery/pipeline";
import { getRedisConnection } from "../connection";
import { DISCOVERY_QUEUE_NAME, type DiscoveryJobData } from "../jobs/discovery.job";

export async function processDiscoveryJob(job: Job<DiscoveryJobData>) {
  try {
    const result = await runDiscoveryPipeline(job.data.jobId);
    console.log(`Discovery completed for job ${job.data.jobId}`);
    return result;
  } catch (error) {
    await markJobFailed(job.data.jobId, error);
    throw error;
  }
}

async function markJobFailed(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await db
    .update(leadDiscoveryJobs)
    .set({
      status: "failed",
      errorMessage: message,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leadDiscoveryJobs.id, jobId));
}

if (process.env.NODE_ENV !== "production" || process.env.ENABLE_WORKERS === "true") {
  const connection = getRedisConnection();
  const worker = new Worker(DISCOVERY_QUEUE_NAME, processDiscoveryJob, {
    connection,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    console.log(`Discovery job done: ${job.data.jobId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Discovery job failed: ${job?.data?.jobId}`, err);
  });
}
