import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentChannelBindings, agentChannelEvents } from "@/lib/db/schema";
import type { AgentChannel } from "@/lib/agent/types";

type ClaimChannelEventInput = {
  channel: AgentChannel;
  externalEventId: string;
  externalUserId?: string;
  externalChatId?: string;
  metadata?: Record<string, unknown>;
};

export async function claimChannelEvent(input: ClaimChannelEventInput) {
  const eventId = input.externalEventId.trim();
  if (!eventId) return true;

  const tenantId = await findBoundTenantId(input.channel, input.externalUserId);
  const insertedEvents = await db
    .insert(agentChannelEvents)
    .values({
      tenantId,
      channel: input.channel,
      externalEventId: eventId,
      externalUserId: input.externalUserId,
      externalChatId: input.externalChatId,
      metadata: input.metadata || {},
    })
    .onConflictDoNothing()
    .returning({ id: agentChannelEvents.id });

  return insertedEvents.length > 0;
}

async function findBoundTenantId(channel: AgentChannel, externalUserId?: string) {
  if (!externalUserId) return null;

  const [binding] = await db
    .select({ tenantId: agentChannelBindings.tenantId })
    .from(agentChannelBindings)
    .where(
      and(
        eq(agentChannelBindings.channel, channel),
        eq(agentChannelBindings.externalUserId, externalUserId),
        eq(agentChannelBindings.isActive, true)
      )
    )
    .limit(1);

  return binding?.tenantId || null;
}
