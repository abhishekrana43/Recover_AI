import { prisma } from "@recover-ai/database";

import type { VoiceCallStatus } from "../providers/voice/voice-provider.types.js";

const STATUS_ORDER: Record<VoiceCallStatus, number> = {
  QUEUED: 1,
  RINGING: 2,
  IN_PROGRESS: 3,
  COMPLETED: 4,
  FAILED: 4,
};

export async function updateVoiceCallStatus(
  providerCallId: string,
  status: VoiceCallStatus
) {
  const voiceCall = await prisma.voiceCall.findUnique({
    where: {
      providerCallId,
    },
  });

  if (!voiceCall) {
    throw new Error(
      `Voice call not found: ${providerCallId}`
    );
  }

  const currentOrder =
    STATUS_ORDER[voiceCall.status];

  const nextOrder = STATUS_ORDER[status];

  if (
    voiceCall.status === "COMPLETED" ||
    voiceCall.status === "FAILED"
  ) {
    return voiceCall;
  }

  if (nextOrder < currentOrder) {
    return voiceCall;
  }

  const now = new Date();

  const data = {
    status,
    ...(status === "IN_PROGRESS"
      ? { answeredAt: voiceCall.answeredAt ?? now }
      : {}),
    ...(status === "COMPLETED"
      ? { completedAt: voiceCall.completedAt ?? now }
      : {}),
  };

  return prisma.voiceCall.update({
    where: {
      id: voiceCall.id,
    },
    data,
  });
}