function isFilledValue(value: unknown) {
  if (Array.isArray(value)) return value.some(isFilledValue);
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

export function compactSlots(slots: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(slots).filter(([, slotValue]) => isFilledValue(slotValue))
  );
}

export function readStringSlot(slots: Record<string, unknown>, key: string) {
  const value = slots[key];
  return typeof value === "string" ? value.trim() : "";
}

export function readNumberSlot(slots: Record<string, unknown>, key: string) {
  const value = slots[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsedNumber = Number(value.match(/\d+/)?.[0]);
  return Number.isFinite(parsedNumber) ? parsedNumber : undefined;
}

export function readStringArraySlot(slots: Record<string, unknown>, key: string) {
  const value = slots[key];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value.split(/[，,\n、]/).map((item) => item.trim()).filter(Boolean);
}

export function mergeSlots(
  currentSlots: Record<string, unknown>,
  incomingSlots: Record<string, unknown>
) {
  return compactSlots({ ...currentSlots, ...compactSlots(incomingSlots) });
}

export function findMissingSlots(requiredSlots: string[], slots: Record<string, unknown>) {
  return requiredSlots.filter((slotName) => !isFilledValue(slots[slotName]));
}
