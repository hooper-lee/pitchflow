import { z } from "zod";

export const followupJobSchema = z.object({
  campaignId: z.string().uuid(),
  tenantId: z.string().uuid(),
  aiProvider: z.enum(["claude", "openai"]).default("claude"),
});

export type FollowupJobData = z.infer<typeof followupJobSchema>;
