import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import {
  createProspectResearch,
  getProspectResearchAndScores,
  runProspectResearchPipeline,
} from "@/lib/services/research.service";
import { getProspect } from "@/lib/services/prospect.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

// GET /api/v1/prospects/[id]/research - 获取调研和评分信息
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();

    // 验证 prospect 属于该租户
    const prospect = await getProspect(params.id, tenantId);
    if (!prospect) {
      return apiError("Prospect not found", 404);
    }

    const { research, scores } = await getProspectResearchAndScores(params.id);

    return apiResponse({
      prospect: {
        id: prospect.id,
        companyName: prospect.companyName,
        website: prospect.website,
        status: prospect.status,
        researchStatus: research?.status || "pending",
      },
      research: research
        ? {
            id: research.id,
            status: research.status,
            aiSummary: research.aiSummary,
            companyDescription: research.companyDescription,
            employeeCount: research.employeeCount,
            companyType: research.companyType,
            mainProducts: research.mainProducts,
            targetMarkets: research.targetMarkets,
            decisionMakers: research.decisionMakers,
            errorMessage: research.errorMessage,
            createdAt: research.createdAt,
            updatedAt: research.updatedAt,
          }
        : null,
      scores: scores
        ? {
            id: scores.id,
            websiteScore: scores.websiteScore,
            icpFitScore: scores.icpFitScore,
            buyingIntentScore: scores.buyingIntentScore,
            reachabilityScore: scores.reachabilityScore,
            dealPotentialScore: scores.dealPotentialScore,
            riskPenaltyScore: scores.riskPenaltyScore,
            overallScore: scores.overallScore,
            leadGrade: scores.leadGrade,
            priorityLevel: scores.priorityLevel,
            recommendedAction: scores.recommendedAction,
            actionReason: scores.actionReason,
            createdAt: scores.createdAt,
            updatedAt: scores.updatedAt,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/v1/prospects/[id]/research - 触发调研
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json().catch(() => ({}));
    const { aiProvider } = body;

    // 验证 prospect 属于该租户
    const prospect = await getProspect(params.id, tenantId);
    if (!prospect) {
      return apiError("Prospect not found", 404);
    }

    // 创建调研记录
    const research = await createProspectResearch(params.id);

    // 异步执行调研和评分（不等待完成）
    runProspectResearchPipeline(params.id, aiProvider).catch((error) => {
      console.error("Research pipeline failed:", error);
    });

    return apiResponse({
      message: "Research started",
      researchId: research.id,
      started: research.status !== "pending" ? false : true,
      status: research.status === "processing" ? "processing" : "pending",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
