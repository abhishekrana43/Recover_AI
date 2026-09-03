import "dotenv/config";

import { prisma } from "@recover-ai/database";

import { processWebhookRetries } from "../../workers/webhook-retry.worker.js";

async function run() {
  const eventId =
    `retry_test_${Date.now()}`;

  /*
   * Create an event that should be
   * picked up immediately by the worker.
   *
   * PAYMENT_CAPTURED is used because the
   * dispatcher already supports it.
   */
  const event =
    await prisma.webhookEvent.create({
      data: {
        eventId,
        eventType: "payment.captured",
        provider: "RAZORPAY",
        payload: {
          payload: {
            payment: {
              entity: {
                id: `pay_retry_${Date.now()}`,
                order_id: `order_missing_${Date.now()}`,
                amount: 49900,
                currency: "INR",
              },
            },
          },
        },
        status: "RETRY_PENDING",
        processed: false,
        processingAttempts: 0,
        nextRetryAt: new Date(
          Date.now() - 1000
        ),
      },
    });

  console.log(
    "\n=== Before retry ==="
  );

  console.log({
    eventId: event.eventId,
    status: event.status,
    attempts: event.processingAttempts,
  });

  /*
   * Worker should pick up the event.
   *
   * This particular payload intentionally references
   * a nonexistent payment attempt, so the dispatcher
   * should fail and the worker should schedule a retry.
   */
  await processWebhookRetries();

  const afterFirstAttempt =
    await prisma.webhookEvent.findUnique({
      where: {
        id: event.id,
      },
    });

  if (!afterFirstAttempt) {
    throw new Error(
      "Webhook event disappeared."
    );
  }

  console.log(
    "\n=== After first retry ==="
  );

  console.log({
    status:
      afterFirstAttempt.status,
    attempts:
      afterFirstAttempt.processingAttempts,
    nextRetryAt:
      afterFirstAttempt.nextRetryAt,
    lastError:
      afterFirstAttempt.lastError,
  });

  if (
    afterFirstAttempt.status !==
    "RETRY_PENDING"
  ) {
    throw new Error(
      `Expected RETRY_PENDING, got ${afterFirstAttempt.status}`
    );
  }

  if (
    afterFirstAttempt.processingAttempts !==
    1
  ) {
    throw new Error(
      `Expected 1 attempt, got ${afterFirstAttempt.processingAttempts}`
    );
  }

  if (!afterFirstAttempt.lastError) {
    throw new Error(
      "Expected lastError to be populated."
    );
  }

  if (!afterFirstAttempt.nextRetryAt) {
    throw new Error(
      "Expected nextRetryAt to be populated."
    );
  }

  /*
   * Force the event to become retryable again.
   */
  await prisma.webhookEvent.update({
    where: {
      id: event.id,
    },
    data: {
      nextRetryAt: new Date(
        Date.now() - 1000
      ),
    },
  });

  await processWebhookRetries();

  const afterSecondAttempt =
    await prisma.webhookEvent.findUnique({
      where: {
        id: event.id,
      },
    });

  if (!afterSecondAttempt) {
    throw new Error(
      "Webhook event disappeared after second retry."
    );
  }

  if (
    afterSecondAttempt.processingAttempts !==
    2
  ) {
    throw new Error(
      `Expected 2 attempts, got ${afterSecondAttempt.processingAttempts}`
    );
  }

  console.log(
    "\n=== Retry worker test ==="
  );

  console.log({
    status:
      afterSecondAttempt.status,
    attempts:
      afterSecondAttempt.processingAttempts,
    lastError:
      afterSecondAttempt.lastError,
  });

  console.log(
    "\n✓ Webhook retry worker test passed"
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\n✗ Webhook retry worker test failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}