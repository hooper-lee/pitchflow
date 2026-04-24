import { z } from "zod";

export const DISCOVERY_QUEUE_NAME = "lead-discovery";

export const discoveryJobSchema = z.object({
  jobId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().optional(),
});

export type DiscoveryJobData = z.infer<typeof discoveryJobSchema>;
