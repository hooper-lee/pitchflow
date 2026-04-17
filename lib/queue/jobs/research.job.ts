import { z } from "zod";

export const researchJobSchema = z.object({
  prospectId: z.string().uuid(),
  tenantId: z.string().uuid(),
  aiProvider: z.enum(["claude", "openai"]).default("claude"),
});

export type ResearchJobData = z.infer<typeof researchJobSchema>;
