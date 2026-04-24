import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

const connection = getRedisConnection();

export const emailSendQueue = new Queue("email-send", { connection });
export const followUpQueue = new Queue("follow-up", { connection });
export const researchQueue = new Queue("prospect-research", { connection });
export const alertQueue = new Queue("alert-dispatch", { connection });
export const leadDiscoveryQueue = new Queue("lead-discovery", { connection });

let followupSchedulePromise: Promise<void> | null = null;

export function ensureFollowupSchedule() {
  if (followupSchedulePromise) {
    return followupSchedulePromise;
  }

  followupSchedulePromise = followUpQueue
    .add(
      "process-followups",
      { source: "worker" },
      {
        jobId: "process-followups-recurring",
        repeat: { every: 15 * 60 * 1000 },
        removeOnComplete: true,
        removeOnFail: 100,
      }
    )
    .then(() => undefined)
    .catch((error) => {
      followupSchedulePromise = null;
      throw error;
    });

  return followupSchedulePromise;
}
