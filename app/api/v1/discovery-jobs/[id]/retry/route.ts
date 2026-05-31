import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";
import { db } from "@/lib/db";
import { leadDiscoveryJobs } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { leadDiscoveryQueue } from "@/lib/queue";

interface RouteContext {
  params: { id: string };
}

/**
 * 重试失败的挖掘任务：重置状态为 pending，清除错误信息并重新入队
 */
export async function POST(_: NextRequest, { params }: RouteContext) {
  try {
    const { tenantId, user } = await requireTenant();

    // 查找任务并验证属于该 tenant
    const [job] = await db
      .select()
      .from(leadDiscoveryJobs)
      .where(
        and(
          eq(leadDiscoveryJobs.id, params.id),
          eq(leadDiscoveryJobs.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!job) {
      return apiError("Discovery job not found", 404);
    }

    if (job.status !== "failed") {
      return apiError("只能重试已失败的任务", 400);
    }

    // 重置状态和统计数据
    const [updatedJob] = await db
      .update(leadDiscoveryJobs)
      .set({
        status: "pending",
        errorMessage: null,
        searchedCount: 0,
        crawledCount: 0,
        candidateCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        savedCount: 0,
        progress: 0,
        startedAt: null,
        finishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(leadDiscoveryJobs.id, params.id))
      .returning();

    // 重新入队
    await leadDiscoveryQueue.add("run-discovery-job", {
      jobId: job.id,
      tenantId,
      userId: user.id,
    });

    return apiResponse(updatedJob);
  } catch (error) {
    return handleApiError(error);
  }
}
