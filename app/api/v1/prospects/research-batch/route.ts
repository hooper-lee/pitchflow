import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { createProspectResearch, runProspectResearchPipeline } from "@/lib/services/research.service";
import { listProspects } from "@/lib/services/prospect.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

// POST /api/v1/prospects/research-batch - 批量触发调研
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();
    const { prospectIds, limit = 10, status = "new", aiProvider } = body;

    let targetIds: string[] = [];

    if (prospectIds && Array.isArray(prospectIds)) {
      // 指定客户 ID
      targetIds = prospectIds.slice(0, limit);
    } else {
      // 根据状态筛选
      const result = await listProspects({
        tenantId,
        status,
        limit,
        page: 1,
      });
      targetIds = result.items.map((p) => p.id);
    }

    // 为每个 prospect 创建调研记录
    const researchTasks = await Promise.all(
      targetIds.map(async (prospectId) => {
        try {
          const research = await createProspectResearch(prospectId);
          // 异步执行调研和评分
          runProspectResearchPipeline(prospectId, aiProvider).catch((error) => {
            console.error(`Research pipeline failed for ${prospectId}:`, error);
          });
          return {
            prospectId,
            researchId: research.id,
            status: research.status === "processing" ? "processing" : "started",
          };
        } catch (error) {
          return {
            prospectId,
            error: error instanceof Error ? error.message : "Unknown error",
            status: "failed",
          };
        }
      })
    );

    return apiResponse({
      message: `Started research for ${researchTasks.filter((t) => t.status !== "failed").length} prospects`,
      tasks: researchTasks,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
