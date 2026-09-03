import "dotenv/config";

import { prisma } from "@recover-ai/database";
import { handleVoiceWebhook } from "../../events/voice-webhook-idempotency.service.js";

async function run() {
  const eventId = `voice_failed_retry_${Date.now()}`;
  const providerCallId = `nonexistent_call_${Date.now()}`;

  /*
   * First create a FAILED webhook event.
   *
   * This simulates a previous processing attempt
   * that failed.
   */
  const existing =
    await prisma.voiceWebhookEvent.create({
      data: {
        eventId,
        provider: "MOCK",
        providerCallId,
        eventType: "VOICE_CALL_EVENT",
        payload: {
          providerCallId,
          provider: "MOCK",
          status: "COMPLETED",
          transcript: "Customer promised to pay tomorrow.",
        },
        processed: false,
        status: "FAILED",
        lastError: "Previous processing attempt failed",
      },
    });

  console.log("\n=== Before retry ===");

  console.log({
    eventId: existing.eventId,
    status: existing.status,
    processed: existing.processed,
  });

  /*
   * The provider call does not exist, so this retry
   * is expected to fail again.
   *
   * The important thing is that it must NOT be
   * returned as a duplicate.
   */
  let duplicateResult: boolean | undefined;

  try {
    const result = await handleVoiceWebhook(
      {
        eventId,
        provider: "MOCK",
        providerCallId,
        status: "COMPLETED",
        transcript:
          "Customer promised to pay tomorrow.",
      },
      {
        providerCallId,
        provider: "MOCK",
        status: "COMPLETED",
        transcript:
          "Customer promised to pay tomorrow.",
      }
    );

    duplicateResult = result.duplicate;
  } catch (error) {
    console.log(
      "\nExpected retry processing error:",
      error instanceof Error
        ? error.message
        : error
    );
  }

  const afterRetry =
    await prisma.voiceWebhookEvent.findUnique({
      where: {
        id: existing.id,
      },
    });

  if (!afterRetry) {
    throw new Error(
      "Voice webhook event not found after retry."
    );
  }

  console.log("\n=== After retry ===");

  console.log({
    status: afterRetry.status,
    processed: afterRetry.processed,
    lastError: afterRetry.lastError,
  });

  /*
   * It must have attempted processing.
   *
   * If duplicateResult were true, the FAILED event
   * would have been incorrectly ignored.
   */
  if (duplicateResult === true) {
    throw new Error(
      "FAILED voice webhook was incorrectly treated as duplicate."
    );
  }

  /*
   * Because providerCallId does not exist, processing
   * should fail again and remain FAILED.
   */
  if (afterRetry.status !== "FAILED") {
    throw new Error(
      `Expected FAILED after retry, got ${afterRetry.status}`
    );
  }

  if (afterRetry.processed !== false) {
    throw new Error(
      "Expected processed=false after failed retry."
    );
  }

  if (!afterRetry.lastError) {
    throw new Error(
      "Expected lastError after failed retry."
    );
  }

  console.log(
    "\n✓ FAILED voice webhook retry test passed"
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\n✗ FAILED voice webhook retry test failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}