import { prisma } from "@recover-ai/database";

import type { ActionExecutionResult } from "../action-executor.types.js";
import { initiateVoiceRecovery } from "../../recovery/voice-recovery.service.js";

export async function executeVoiceRecovery(
  actionId: string
): Promise<ActionExecutionResult> {
  console.log(
    `Executing VOICE_RECOVERY action: ${actionId}`
  );

  const action =
    await prisma.recoveryAction.findUnique({
      where: {
        id: actionId,
      },
    });

  if (!action) {
    throw new Error(
      `Recovery action not found: ${actionId}`
    );
  }

  const result = await initiateVoiceRecovery(
    action.recoveryCaseId
  );

  if (!result.providerCallId) {
    throw new Error(
      "Voice recovery was initiated but no provider call ID was returned"
    );
  }

  return {
    success: true,
    action: "VOICE_RECOVERY",
    externalProviderId: result.providerCallId,
    result: {
      recoveryCaseId: result.recoveryCaseId,
      voiceCallId: result.voiceCallId,
      provider: result.provider,
      providerCallId: result.providerCallId,
      ...(result.status !== undefined
        ? { status: result.status }
        : {}),
    },
  };
}