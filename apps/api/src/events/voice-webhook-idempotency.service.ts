import { prisma } from "@recover-ai/database";

import { processVoiceWebhook } from "./voice-webhook.service.js";

import type {
  VoiceWebhookEvent,
} from "../providers/voice/voice-webhook.types.js";

function isUniqueConstraintError(
  error: unknown
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function handleVoiceWebhook(
  event: VoiceWebhookEvent,
  rawPayload: unknown
): Promise<{ duplicate: boolean }> {
  const existing =
    await prisma.voiceWebhookEvent.findUnique({
      where: {
        eventId: event.eventId,
      },
    });

  /*
   * Already successfully processed.
   */
  if (existing?.status === "PROCESSED") {
    return {
      duplicate: true,
    };
  }

  /*
   * Another request is currently processing it.
   */
  if (existing?.status === "PROCESSING") {
    return {
      duplicate: true,
    };
  }

  let webhookEvent;

  /*
   * New event.
   */
  if (!existing) {
    try {
      webhookEvent =
        await prisma.voiceWebhookEvent.create({
          data: {
            eventId: event.eventId,
            provider: event.provider,
            providerCallId:
              event.providerCallId,
            eventType: "VOICE_CALL_EVENT",
            payload: rawPayload as object,
            status: "PROCESSING",
          },
        });
    } catch (error) {
      /*
       * Another request created the same event
       * between findUnique() and create().
       */
      if (isUniqueConstraintError(error)) {
        return {
          duplicate: true,
        };
      }

      throw error;
    }
  } else {
    /*
     * Existing FAILED event.
     *
     * Atomically claim it for retry.
     */
    const claimed =
      await prisma.voiceWebhookEvent.updateMany({
        where: {
          id: existing.id,
          status: "FAILED",
        },
        data: {
          status: "PROCESSING",
          processed: false,
          lastError: null,
        },
      });

    if (claimed.count !== 1) {
      return {
        duplicate: true,
      };
    }

    webhookEvent = existing;
  }

  try {
    await processVoiceWebhook(event);

    await prisma.voiceWebhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        processed: true,
        status: "PROCESSED",
        processedAt: new Date(),
        lastError: null,
      },
    });

    return {
      duplicate: false,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown voice webhook error";

    await prisma.voiceWebhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        processed: false,
        status: "FAILED",
        lastError: message,
      },
    });

    throw error;
  }
}