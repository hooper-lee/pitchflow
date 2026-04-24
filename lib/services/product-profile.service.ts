import { getTenant, updateTenantSettings } from "@/lib/services/tenant.service";

export interface ProductProfile {
  companyName?: string;
  productName?: string;
  productDescription?: string;
  valueProposition?: string;
  senderName?: string;
  senderTitle?: string;
}

const DEFAULT_PRODUCT_PROFILE: Required<ProductProfile> = {
  companyName: "",
  productName: "our products and services",
  productDescription: "",
  valueProposition: "",
  senderName: "Our Team",
  senderTitle: "",
};

export async function getProductProfile(tenantId: string): Promise<Required<ProductProfile>> {
  const tenant = await getTenant(tenantId);
  const settings = (tenant?.settings as Record<string, unknown>) || {};
  const productProfile = settings.productProfile as ProductProfile | undefined;

  return {
    ...DEFAULT_PRODUCT_PROFILE,
    ...normalizeProductProfile(productProfile || {}),
  };
}

export async function updateProductProfile(tenantId: string, input: ProductProfile) {
  const tenant = await getTenant(tenantId);
  const settings = (tenant?.settings as Record<string, unknown>) || {};
  const productProfile = normalizeProductProfile(input);

  return updateTenantSettings(tenantId, {
    ...settings,
    productProfile,
  });
}

function normalizeProductProfile(input: ProductProfile): ProductProfile {
  return {
    companyName: normalizeString(input.companyName),
    productName: normalizeString(input.productName),
    productDescription: normalizeString(input.productDescription),
    valueProposition: normalizeString(input.valueProposition),
    senderName: normalizeString(input.senderName),
    senderTitle: normalizeString(input.senderTitle),
  };
}

function normalizeString(value?: string) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
