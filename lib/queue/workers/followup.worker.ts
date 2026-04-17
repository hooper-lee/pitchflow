import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { processPendingFollowups } from "@/lib/services/followup.service";
import type { FollowupJobData } from "../jobs/followup.job";

export async function processFollowupJob(job: Job<FollowupJobData>) {
  const result = await processPendingFollowups();
  console.log(`Follow-up job completed: ${result.totalProcessed} emails processed`);
  return result;
}

if (process.env.NODE_ENV !== "production" || process.env.ENABLE_WORKERS === "true") {
  const connection = getRedisConnection();
  const worker = new Worker("follow-up", processFollowupJob, {
    connection,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    console.log(`Follow-up job done: ${JSON.stringify(job.returnvalue)}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Follow-up job failed: ${job?.id}`, err);
  });
}
