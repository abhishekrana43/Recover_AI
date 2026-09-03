import { prisma } from "@recover-ai/database";
import { dispatchWebhookEvent } from "../events/event.dispatcher.js";

const MAX_ATTEMPTS = 5;
const LOCK_TIMEOUT_MS = 60_000;

export async function processWebhookRetries(): Promise<void> {
  const now = new Date();

  const events = await prisma.webhookEvent.findMany({
    where: {
      status: "RETRY_PENDING",
      processingAttempts: {
        lt: MAX_ATTEMPTS,
      },
      OR: [
        {
          nextRetryAt: null,
        },
        {
          nextRetryAt: {
            lte: now,
          },
        },
        {
          lockedAt: {
            lt: new Date(
              now.getTime() - LOCK_TIMEOUT_MS
            ),
          },
        },
      ],
    },
    orderBy: {
      receivedAt: "asc",
    },
    take: 10,
  });

  for (const event of events) {
    await processWebhookRetry(event.id);
  }
}

async function processWebhookRetry(
  eventId: string
): Promise<void> {
  const event = await prisma.webhookEvent.findUnique({
    where: {
      id: eventId,
    },
  });

  if (!event) {
    return;
  }

  if (
    event.status !== "RETRY_PENDING" ||
    event.processingAttempts >= MAX_ATTEMPTS
  ) {
    return;
  }

  /*
   * Claim the event.
   *
   * Only one worker should be able to transition
   * this event from RETRY_PENDING → PROCESSING.
   */
  const claimed = await prisma.webhookEvent.updateMany({
    where: {
      id: event.id,
      status: "RETRY_PENDING",
      processingAttempts: {
        lt: MAX_ATTEMPTS,
      },
    },
    data: {
      status: "PROCESSING",
      processingAttempts: {
        increment: 1,
      },
      lockedAt: new Date(),
      lastError: null,
    },
  });

  if (claimed.count !== 1) {
    return;
  }

  try {
    await dispatchWebhookEvent(
      event.eventType,
      event.payload
    );

    await prisma.webhookEvent.update({
      where: {
        id: event.id,
      },
      data: {
        status: "PROCESSED",
        processed: true,
        processedAt: new Date(),
        lockedAt: null,
        nextRetryAt: null,
        lastError: null,
      },
    });

    console.log(
      `Webhook retry processed successfully: ${event.eventId}`
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown webhook retry error";

    /*
     * Re-read the attempt count because another process
     * may have changed the row.
     */
    const current =
      await prisma.webhookEvent.findUnique({
        where: {
          id: event.id,
        },
        select: {
          processingAttempts: true,
        },
      });

    if (!current) {
      return;
    }

    const shouldRetry =
      current.processingAttempts < MAX_ATTEMPTS;

    const delaySeconds = Math.min(
      Math.pow(
        2,
        current.processingAttempts
      ),
      300
    );

    await prisma.webhookEvent.update({
      where: {
        id: event.id,
      },
      data: {
        status: shouldRetry
          ? "RETRY_PENDING"
          : "FAILED",

        processed: false,

        lastError: errorMessage,

        nextRetryAt: shouldRetry
          ? new Date(
              Date.now() +
                delaySeconds * 1000
            )
          : null,

        lockedAt: null,
      },
    });

    console.error(
      `Webhook retry failed: ${event.eventId}`,
      {
        attempt:
          current.processingAttempts,
        maxAttempts: MAX_ATTEMPTS,
        nextRetryAt: shouldRetry
          ? new Date(
              Date.now() +
                delaySeconds * 1000
            )
          : null,
        error: errorMessage,
      }
    );
  }
}