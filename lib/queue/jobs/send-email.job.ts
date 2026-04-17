import { z } from "zod";

export const sendEmailJobSchema = z.object({
  emailId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  from: z.string().email(),
  campaignId: z.string().uuid(),
  prospectId: z.string().uuid(),
});

export type SendEmailJobData = z.infer<typeof sendEmailJobSchema>;
