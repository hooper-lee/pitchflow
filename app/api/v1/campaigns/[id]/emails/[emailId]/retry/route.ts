import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { retryCampaignEmail, retryCampaignEmailWithProgress, type RetryEmailProgress } from "@/lib/services/campaign.service";
import { logAuditEvent } from "@/lib/services/audit.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

function createJsonLine(event: Record<string, unknown> | RetryEmailProgress) {
  return `${JSON.stringify(event)}\n`;
}

function createStreamResponse(
  task: Promise<{ id: string }>,
  bindProgress: (emit: (event: RetryEmailProgress) => void) => void
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: RetryEmailProgress) => {
        controller.enqueue(encoder.encode(createJsonLine(event)));
      };

      bindProgress(emit);

      try {
        const result = await task;
        controller.enqueue(encoder.encode(createJsonLine({ type: "done", emailId: result.id })));
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            createJsonLine({
              type: "error",
              message: error instanceof Error ? error.message : "重新同步失败",
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; emailId: string } }
) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = await request.json().catch(() => ({}));

    if (body.stream) {
      let progressListener: ((event: RetryEmailProgress) => void) | undefined;
      const task = retryCampaignEmailWithProgress(
        params.id,
        params.emailId,
        tenantId,
        (event) => progressListener?.(event)
      ).then(async (email) => {
        await logAuditEvent({
          userId: user.id,
          tenantId,
          action: "retry",
          resource: "campaign_email",
          resourceId: params.emailId,
          detail: { campaignId: params.id },
          ip: request.headers.get("x-forwarded-for") || null,
        });
        return email;
      });

      return createStreamResponse(task, (emit) => {
        progressListener = emit;
      });
    }

    const email = await retryCampaignEmail(params.id, params.emailId, tenantId);

    await logAuditEvent({
      userId: user.id,
      tenantId,
      action: "retry",
      resource: "campaign_email",
      resourceId: params.emailId,
      detail: { campaignId: params.id },
      ip: request.headers.get("x-forwarded-for") || null,
    });

    return apiResponse(email);
  } catch (error) {
    return handleApiError(error);
  }
}
