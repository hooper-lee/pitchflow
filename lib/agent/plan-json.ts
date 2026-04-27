import { z } from "zod";

export const modelPlanSchema = z.object({
  intent: z.string().min(1).max(100),
  toolName: z.string().min(1).optional().nullable(),
  input: z.record(z.string(), z.unknown()).default({}),
  needApproval: z.boolean().default(false),
  reply: z.string().min(1).max(1000),
});

export type ModelPlan = z.infer<typeof modelPlanSchema>;

export const modelIntentPlanSchema = z.object({
  intent: z.string().min(1).max(100),
  slots: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(0.5),
  reply: z.string().min(1).max(1000),
});

export type ModelIntentPlan = z.infer<typeof modelIntentPlanSchema>;

function cleanJsonText(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

export function parsePlannerJson(text: string): ModelPlan {
  const cleanedText = cleanJsonText(text);
  const jsonText = cleanedText.match(/\{[\s\S]*\}/)?.[0] || cleanedText;
  return modelPlanSchema.parse(JSON.parse(jsonText));
}

export function parseIntentPlannerJson(text: string): ModelIntentPlan {
  const cleanedText = cleanJsonText(text);
  const jsonText = cleanedText.match(/\{[\s\S]*\}/)?.[0] || cleanedText;
  return modelIntentPlanSchema.parse(JSON.parse(jsonText));
}
