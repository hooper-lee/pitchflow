import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getAIProviderWithConfig, buildOutreachPrompt, buildFollowupPrompt } from "@/lib/ai";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();
    const {
      provider = "custom",
      type = "outreach",
      prospectName,
      companyName,
      industry,
      country,
      researchSummary,
      productName,
      senderName,
      senderTitle,
      angle,
      templateBody,
      previousEmailBody,
      stepNumber,
    } = body;

    const ai = getAIProviderWithConfig(provider as any);

    let prompt: string;
    if (type === "followup") {
      prompt = buildFollowupPrompt({
        prospectName,
        companyName,
        industry: industry || "",
        country: country || "",
        researchSummary,
        productName: productName || "our products",
        senderName,
        senderTitle,
        angle,
        previousEmailBody: previousEmailBody || "",
        stepNumber: stepNumber || 2,
      });
    } else {
      prompt = buildOutreachPrompt({
        prospectName,
        companyName,
        industry: industry || "",
        country: country || "",
        researchSummary,
        productName: productName || "our products",
        senderName,
        senderTitle,
        angle,
        templateBody,
      });
    }

    const result = await ai.generateEmail({ prompt });
    return apiResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
