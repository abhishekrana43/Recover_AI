import { prisma } from "@recover-ai/database";

import {
  updateVoiceCallStatus,
} from "../recovery/voice-call.service.js";

import {
  extractVoiceRecoveryOutcome,
} from "../agent/voice-outcome-extractor.js";

import {
  processVoiceRecoveryOutcome,
} from "../recovery/voice-outcome.service.js";

import type {
  VoiceWebhookEvent,
} from "../providers/voice/voice-webhook.types.js";

export async function processVoiceWebhook(
  event: VoiceWebhookEvent
): Promise<void> {
  const voiceCall =
    await prisma.voiceCall.findUnique({
      where: {
        providerCallId: event.providerCallId,
      },
    });

  if (!voiceCall) {
    throw new Error(
      `Voice call not found: ${event.providerCallId}`
    );
  }

  /*
   * Update provider call status.
   */
  if (event.status) {
    await updateVoiceCallStatus(
      event.providerCallId,
      event.status
    );
  }

  /*
   * Handle provider failure.
   */
  if (event.failureReason) {
    await prisma.voiceCall.update({
      where: {
        id: voiceCall.id,
      },
      data: {
        failureReason: event.failureReason,
        status: "FAILED",
      },
    });

    return;
  }

  /*
   * Nothing to process until we receive
   * a transcript.
   */
  if (!event.transcript) {
    return;
  }

  /*
   * Store transcript.
   */
  await prisma.voiceCall.update({
    where: {
      id: voiceCall.id,
    },
    data: {
      transcript: event.transcript,
    },
  });

  /*
   * Extract structured recovery outcome
   * from the transcript.
   */
  const outcome =
    await extractVoiceRecoveryOutcome({
      transcript: event.transcript,
    });

  /*
   * Process the business outcome.
   *
   * This handles:
   * PROMISE_TO_PAY
   * PAYMENT_COMPLETED
   * DECLINED
   * NO_RESPONSE
   * CALL_FAILED
   */
  await processVoiceRecoveryOutcome(
    voiceCall.recoveryCaseId,
    voiceCall.id,
    {
      outcome: outcome.outcome,
      confidence: outcome.confidence,
      summary: outcome.summary,

      ...(outcome.promisedFor
        ? {
            promisedFor: new Date(
              outcome.promisedFor
            ),
          }
        : {}),

      ...(outcome.notes
        ? {
            notes: outcome.notes,
          }
        : {}),
    }
  );
}