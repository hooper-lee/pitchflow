import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { processAlert, type AlertTrigger } from "@/lib/services/alert.service";

interface AlertJobData {
  emailId: string;
  trigger: AlertTrigger;
}

export async function processAlertJob(job: Job<AlertJobData>) {
  const { emailId, trigger } = job.data;
  await processAlert(emailId, trigger);
  console.log(`Alert processed for email ${emailId}`);
}

if (process.env.NODE_ENV !== "production" || process.env.ENABLE_WORKERS === "true") {
  const connection = getRedisConnection();
  const worker = new Worker("alert-dispatch", processAlertJob, {
    connection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`Alert dispatched: ${job.data.emailId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Alert failed: ${job?.data?.emailId}`, err);
  });
}
