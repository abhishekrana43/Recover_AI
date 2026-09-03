import "dotenv/config";

import { prisma } from "@recover-ai/database";

import { handleVoiceWebhook } from "../../events/voice-webhook-idempotency.service.js";

async function run() {
  const voiceCall = await prisma.voiceCall.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!voiceCall) {
    throw new Error("No VoiceCall found.");
  }

  const eventId =
    `voice_test_${Date.now()}`;

  const event = {
    eventId,
    provider: voiceCall.provider,
    providerCallId:
      voiceCall.providerCallId,
    status: "COMPLETED" as const,
    transcript:
      "I will pay tomorrow.",
  };

  console.log("\n=== First webhook ===");

  const first =
    await handleVoiceWebhook(
      event,
      event
    );

  console.log(first);

  if (first.duplicate) {
    throw new Error(
      "First webhook was incorrectly treated as duplicate."
    );
  }

  console.log("\n=== Second webhook ===");

  const second =
    await handleVoiceWebhook(
      event,
      event
    );

  console.log(second);

  if (!second.duplicate) {
    throw new Error(
      "Second webhook was not detected as duplicate."
    );
  }

  const webhookEvents =
  await prisma.voiceWebhookEvent.findMany({
    where: {
      eventId,
    },
  });

if (webhookEvents.length !== 1) {
  throw new Error(
    `Expected exactly 1 webhook event, found ${webhookEvents.length}`
  );
}

const webhookEvent = webhookEvents[0];

if (!webhookEvent) {
  throw new Error(
    "Webhook event was unexpectedly not found."
  );
}

if (!webhookEvent.processed) {
  throw new Error(
    "Webhook event should be marked processed."
  );
}

  console.log(
    "\n✓ Voice webhook idempotency test passed"
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\n✗ Voice webhook idempotency test failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}