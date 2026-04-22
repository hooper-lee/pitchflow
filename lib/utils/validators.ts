import { z } from "zod";

export const createProspectSchema = z.object({
  companyName: z.string().min(1).max(500).optional(),
  contactName: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  linkedinUrl: z.string().url().optional(),
  whatsapp: z.string().max(50).optional(),
  industry: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  website: z.string().url().optional(),
  source: z.string().max(100).optional(),
});

export const discoverProspectsSchema = z.object({
  domain: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  keywords: z.string().optional(),
  limit: z.number().int().min(5).max(50).default(10),
}).refine((data) => data.domain || data.industry || data.keywords, {
  message: "至少输入域名、行业或关键词之一",
});

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  industry: z.string().max(255).optional(),
  targetPersona: z.string().max(255).optional(),
  templateId: z.string().uuid().optional(),
  prospectIds: z.array(z.string().uuid()).optional(),
  aiProvider: z.enum(["claude", "openai", "custom"]).default("custom"),
  aiConfig: z.object({
    baseURL: z.string().url().optional(),
    apiKey: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
  }).optional(),
});

export const createMailAccountSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  imap: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean(),
    username: z.string().min(1),
    password: z.string().min(1),
  }),
  smtp: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean(),
    username: z.string().min(1),
    password: z.string().min(1),
  }),
  isDefault: z.boolean().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  angle: z.string().max(100).optional(),
  productName: z.string().max(255).optional(),
  senderName: z.string().max(255).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    url: z.string().url(),
    size: z.number().optional(),
  })).optional(),
  isDefault: z.boolean().default(false),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  researchStatus: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  leadGrade: z.enum(["A", "B", "C", "D"]).optional(),
});

export type CreateProspectInput = z.infer<typeof createProspectSchema>;
export type DiscoverProspectsInput = z.infer<typeof discoverProspectsSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type CreateMailAccountInput = z.infer<typeof createMailAccountSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
