import { prisma } from "@recover-ai/database";
import { dispatchWebhookEvent } from "./event.dispatcher.js";

const MAX_ATTEMPTS = 5;

// Lock expires after 60 seconds.
// This prevents a crashed worker from permanently locking an event.
const LOCK_TIMEOUT_MS = 60_000;

export async function retryFailedWebhooks(): Promise<void> {
  const now = new Date();

  const events = await prisma.webhookEvent.findMany({
    where: {
      status: "RETRY_PENDING",
      nextRetryAt: {
        lte: now,
      },
      processingAttempts: {
        lt: MAX_ATTEMPTS,
      },
      OR: [
        {
          lockedAt: null,
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
      nextRetryAt: "asc",
    },
    take: 10,
  });

  for (const event of events) {
    /*
     * Atomically claim the webhook.
     *
     * Only one worker should be able to change
     * RETRY_PENDING → PROCESSING.
     */
    const claimed = await prisma.webhookEvent.updateMany({
      where: {
        id: event.id,
        status: "RETRY_PENDING",
        OR: [
          {
            lockedAt: null,
          },
          {
            lockedAt: {
              lt: new Date(
                Date.now() - LOCK_TIMEOUT_MS
              ),
            },
          },
        ],
      },
      data: {
        status: "PROCESSING",
        lockedAt: new Date(),
        processingAttempts: {
          increment: 1,
        },
        lastError: null,
      },
    });

    // Another worker already claimed it.
    if (claimed.count === 0) {
      console.log(
        `Webhook already locked, skipping: ${event.eventId}`
      );

      continue;
    }

    console.log(
  `Webhook claimed successfully: ${event.eventId}`
);

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
          lastError: null,
          nextRetryAt: null,
          lockedAt: null,
        },
      });

      console.log(
        `Webhook retry succeeded: ${event.eventId}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown webhook retry error";

      /*
       * We incremented processingAttempts when claiming,
       * so read the current value from the database.
       */
      const currentEvent =
        await prisma.webhookEvent.findUnique({
          where: {
            id: event.id,
          },
          select: {
            processingAttempts: true,
          },
        });

      const attempts =
        currentEvent?.processingAttempts ??
        event.processingAttempts + 1;

      const shouldRetry = attempts < MAX_ATTEMPTS;

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
                  Math.pow(2, attempts) * 1000
              )
            : null,

          lockedAt: null,
        },
      });

      console.error(
        `Webhook retry failed: ${event.eventId}`,
        error
      );
    }
  }
}