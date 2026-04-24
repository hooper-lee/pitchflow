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

const stringListSchema = z.array(z.string().min(1)).default([]);
const scoreWeightsSchema = z.record(z.string(), z.number().int().min(0).max(100)).default({});

export const upsertIcpProfileSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  industry: z.string().max(255).optional(),
  targetCustomerText: z.string().max(10000).optional(),
  mustHave: stringListSchema,
  mustNotHave: stringListSchema,
  positiveKeywords: stringListSchema,
  negativeKeywords: stringListSchema,
  productCategories: stringListSchema,
  salesModel: z.string().max(100).optional(),
  scoreWeights: scoreWeightsSchema,
  minScoreToSave: z.number().int().min(0).max(100).default(80),
  minScoreToReview: z.number().int().min(0).max(100).default(60),
  promptTemplate: z.string().max(10000).optional(),
  isDefault: z.boolean().default(false),
});

export const createDiscoveryJobSchema = z.object({
  name: z.string().min(1).max(255),
  icpProfileId: z.string().uuid().optional(),
  industry: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  keywords: z.array(z.string().min(1)).min(1).max(20),
  targetLimit: z.number().int().min(1).max(200).default(50),
  filters: z.record(z.string(), z.unknown()).default({}),
});

export const discoveryJobListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      "pending",
      "searching",
      "crawling",
      "filtering",
      "scoring",
      "reviewing",
      "completed",
      "failed",
      "cancelled",
    ])
    .optional(),
});

export const discoveryCandidateListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  decision: z
    .enum(["pending", "accepted", "rejected", "needs_review", "blacklisted", "saved"])
    .optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  search: z.string().optional(),
});

export const discoveryCandidateActionSchema = z.object({
  action: z.enum(["accept", "reject", "blacklist", "restore", "save_to_prospect"]),
  reason: z.string().max(5000).optional(),
  reasonTags: stringListSchema,
});

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  industry: z.string().max(255).optional(),
  targetPersona: z.string().max(255).optional(),
  campaignType: z.enum(["cold_outreach", "reply_followup"]).default("cold_outreach"),
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
export type UpsertIcpProfileInput = z.infer<typeof upsertIcpProfileSchema>;
export type CreateDiscoveryJobInput = z.infer<typeof createDiscoveryJobSchema>;
export type DiscoveryJobListInput = z.infer<typeof discoveryJobListSchema>;
export type DiscoveryCandidateListInput = z.infer<typeof discoveryCandidateListSchema>;
export type DiscoveryCandidateActionInput = z.infer<typeof discoveryCandidateActionSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type CreateMailAccountInput = z.infer<typeof createMailAccountSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
