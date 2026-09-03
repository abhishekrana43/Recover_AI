import "dotenv/config";

import { prisma } from "@recover-ai/database";
import { processWebhookRetries } from "../../workers/webhook-retry.worker.js";

async function run() {
  const eventId = `retry_exhaustion_${Date.now()}`;

  const event = await prisma.webhookEvent.create({
    data: {
      eventId,
      eventType: "payment.captured",
      provider: "RAZORPAY",
      payload: {
        payload: {
          payment: {
            entity: {
              id: `pay_invalid_${Date.now()}`,
              order_id: `order_invalid_${Date.now()}`,
              amount: 49900,
              currency: "INR",
            },
          },
        },
      },
      status: "RETRY_PENDING",
      processed: false,
      processingAttempts: 4,
      nextRetryAt: new Date(Date.now() - 1000),
    },
  });

  console.log("\n=== Before final retry ===");

  console.log({
    status: event.status,
    attempts: event.processingAttempts,
  });

  await processWebhookRetries();

  const updated = await prisma.webhookEvent.findUnique({
    where: {
      id: event.id,
    },
  });

  if (!updated) {
    throw new Error("Webhook event not found.");
  }

  console.log("\n=== After final retry ===");

  console.log({
    status: updated.status,
    attempts: updated.processingAttempts,
    processed: updated.processed,
    nextRetryAt: updated.nextRetryAt,
    lastError: updated.lastError,
  });

  if (updated.status !== "FAILED") {
    throw new Error(
      `Expected FAILED, got ${updated.status}`
    );
  }

  if (updated.processingAttempts !== 5) {
    throw new Error(
      `Expected 5 attempts, got ${updated.processingAttempts}`
    );
  }

  if (updated.processed !== false) {
    throw new Error(
      "Expected processed=false."
    );
  }

  if (updated.nextRetryAt !== null) {
    throw new Error(
      "Expected nextRetryAt to be null after final failure."
    );
  }

  if (!updated.lastError) {
    throw new Error(
      "Expected lastError after final failure."
    );
  }

  console.log(
    "\n✓ Webhook retry exhaustion test passed"
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\n✗ Webhook retry exhaustion test failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}