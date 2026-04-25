import * as claude from "./claude";
import * as openai from "./openai";
import * as custom from "./custom";

export type AIProviderType = "claude" | "openai" | "custom";

export interface AIProvider {
  generateEmail(params: claude.GenerateEmailParams): Promise<claude.GeneratedEmail>;
  researchProspect(params: {
    prompt: string;
    model?: string;
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<string>;
}

const providers: Record<AIProviderType, AIProvider> = {
  claude: claude,
  openai: openai,
  custom: custom,
};

export function getAIProvider(provider: AIProviderType = "claude"): AIProvider {
  return providers[provider];
}

// For custom provider with per-campaign overrides
export function getAIProviderWithConfig(
  provider: AIProviderType = "claude",
  aiConfig?: { baseURL?: string; apiKey?: string; model?: string }
): AIProvider {
  if (provider === "custom" && aiConfig) {
    return {
      generateEmail: (params) =>
        custom.generateEmail({ ...params, overrides: aiConfig }),
      researchProspect: (params) =>
        custom.researchProspect({ ...params, overrides: aiConfig }),
    };
  }
  return providers[provider];
}

export {
  buildOutreachPrompt,
  buildOutreachPromptFromTemplate,
  buildFollowupPrompt,
  buildFollowupPromptFromTemplate,
  buildReplyFollowupPrompt,
  buildReplyFollowupPromptFromTemplate,
  OUTREACH_SYSTEM_PROMPT,
  FOLLOWUP_SYSTEM_PROMPT,
} from "./prompts";
