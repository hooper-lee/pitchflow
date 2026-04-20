import { z } from "zod";

export const followupJobSchema = z.object({
  source: z.enum(["cron", "worker"]).default("worker"),
});

export type FollowupJobData = z.infer<typeof followupJobSchema>;
