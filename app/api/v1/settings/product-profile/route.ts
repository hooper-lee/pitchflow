import { NextRequest } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";
import {
  getProductProfile,
  updateProductProfile,
} from "@/lib/services/product-profile.service";

const productProfileSchema = z.object({
  companyName: z.string().max(255).optional(),
  productName: z.string().max(255).optional(),
  productDescription: z.string().max(3000).optional(),
  valueProposition: z.string().max(3000).optional(),
  senderName: z.string().max(255).optional(),
  senderTitle: z.string().max(255).optional(),
});

export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    return apiResponse(await getProductProfile(tenantId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const input = productProfileSchema.parse(await request.json());
    const tenant = await updateProductProfile(tenantId, input);
    const settings = (tenant.settings as Record<string, unknown>) || {};
    return apiResponse(settings.productProfile || {});
  } catch (error) {
    return handleApiError(error);
  }
}
