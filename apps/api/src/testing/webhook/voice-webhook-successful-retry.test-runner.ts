import "dotenv/config";

import { prisma } from "@recover-ai/database";

import { handleVoiceWebhook } from "../../events/voice-webhook-idempotency.service.js";

async function run() {
  /*
   * ============================================================
   * 1. Create isolated test data
   * ============================================================
   */

  const merchant = await prisma.merchant.findFirst();

  if (!merchant) {
    throw new Error("No merchant found.");
  }

  const suffix = `${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;

  const customer = await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      name: `Voice Retry Test ${suffix}`,
      email: `voice-retry-${suffix}@example.com`,
      phone: "+919999999999",
    },
  });

  const payment = await prisma.payment.create({
    data: {
      merchantId: merchant.id,
      customerId: customer.id,
      razorpayPaymentId: `pay_voice_retry_${suffix}`,
      amount: 49900,
      currency: "INR",
      status: "FAILED",
      failureReason: "Voice webhook retry integration test",
    },
  });

  const recoveryCase =
    await prisma.recoveryCase.create({
      data: {
        merchantId: merchant.id,
        paymentId: payment.id,
        status: "IN_PROGRESS",
        amountAtRisk: payment.amount,
        failureReason:
          "Voice webhook retry integration test",
      },
    });

  const providerCallId =
    `call_voice_retry_${suffix}`;

  const voiceCall =
    await prisma.voiceCall.create({
      data: {
        recoveryCaseId: recoveryCase.id,
        provider: "MOCK",
        providerCallId,
        status: "COMPLETED",
        phoneNumber: "+919027772881",
      },
    });

  /*
   * Make sure this test starts with no outcome.
   */
  if (voiceCall.outcome !== null) {
    throw new Error(
      "Fresh VoiceCall unexpectedly has an outcome."
    );
  }

  /*
   * ============================================================
   * 2. Create a FAILED webhook
   * ============================================================
   */

  const eventId =
    `voice_success_retry_${suffix}`;

  const failedWebhook =
    await prisma.voiceWebhookEvent.create({
      data: {
        eventId,
        provider: "MOCK",
        providerCallId,
        eventType: "VOICE_CALL_EVENT",
        payload: {
          provider: "MOCK",
          providerCallId,
          status: "COMPLETED",
          transcript:
            "I will pay tomorrow.",
        },
        processed: false,
        status: "FAILED",
        lastError:
          "Simulated previous processing failure",
      },
    });

  console.log(
    "\n=== Before retry ==="
  );

  console.log({
    webhook: failedWebhook.status,
    processed: failedWebhook.processed,
    voiceCall: voiceCall.status,
    outcome: voiceCall.outcome,
    payment: payment.status,
    recoveryCase: recoveryCase.status,
  });

  /*
   * ============================================================
   * 3. Retry the FAILED webhook
   * ============================================================
   */

  const result =
    await handleVoiceWebhook(
      {
        eventId,
        provider: "MOCK",
        providerCallId,
        status: "COMPLETED",
        transcript:
          "I will pay tomorrow.",
      },
      {
        provider: "MOCK",
        providerCallId,
        status: "COMPLETED",
        transcript:
          "I will pay tomorrow.",
      }
    );

  console.log(
    "\n=== Retry result ==="
  );

  console.log(result);

  if (result.duplicate) {
    throw new Error(
      "FAILED webhook was incorrectly treated as duplicate."
    );
  }

  /*
   * ============================================================
   * 4. Read final state
   * ============================================================
   */

  const updatedWebhook =
    await prisma.voiceWebhookEvent.findUnique({
      where: {
        id: failedWebhook.id,
      },
    });

  const updatedVoiceCall =
    await prisma.voiceCall.findUnique({
      where: {
        id: voiceCall.id,
      },
    });

  const updatedCase =
    await prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCase.id,
      },
    });

  const promises =
    await prisma.promiseToPay.findMany({
      where: {
        recoveryCaseId:
          recoveryCase.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  console.log(
    "\n=== After successful retry ==="
  );

  console.log({
    webhook: updatedWebhook?.status,
    processed: updatedWebhook?.processed,
    voiceCall: updatedVoiceCall?.status,
    outcome: updatedVoiceCall?.outcome,
    recoveryCase: updatedCase?.status,
    promiseCount: promises.length,
    promiseStatus: promises[0]?.status,
    promiseSource: promises[0]?.source,
  });

  /*
   * ============================================================
   * 5. Assertions
   * ============================================================
   */

  if (
    updatedWebhook?.status !==
    "PROCESSED"
  ) {
    throw new Error(
      `Expected webhook PROCESSED, got ${updatedWebhook?.status}`
    );
  }

  if (
    updatedWebhook.processed !== true
  ) {
    throw new Error(
      "Expected webhook processed=true."
    );
  }

  if (
    updatedVoiceCall?.outcome !==
    "PROMISE_TO_PAY"
  ) {
    throw new Error(
      `Expected VoiceCall outcome PROMISE_TO_PAY, got ${updatedVoiceCall?.outcome}`
    );
  }

  if (promises.length !== 1) {
    throw new Error(
      `Expected exactly 1 PromiseToPay, found ${promises.length}`
    );
  }

  const promise = promises[0];

  if (!promise) {
    throw new Error(
      "PromiseToPay unexpectedly not found."
    );
  }

  if (promise.status !== "PENDING") {
    throw new Error(
      `Expected PromiseToPay PENDING, got ${promise.status}`
    );
  }

  if (promise.source !== "VOICE") {
    throw new Error(
      `Expected PromiseToPay source VOICE, got ${promise.source}`
    );
  }

  if (
    updatedCase?.status !==
    "IN_PROGRESS"
  ) {
    throw new Error(
      `Expected RecoveryCase IN_PROGRESS, got ${updatedCase?.status}`
    );
  }

  /*
   * ============================================================
   * 6. Verify duplicate retry is harmless
   * ============================================================
   */

  const duplicate =
    await handleVoiceWebhook(
      {
        eventId,
        provider: "MOCK",
        providerCallId,
        status: "COMPLETED",
        transcript:
          "I will pay tomorrow.",
      },
      {
        provider: "MOCK",
        providerCallId,
        status: "COMPLETED",
        transcript:
          "I will pay tomorrow.",
      }
    );

  if (!duplicate.duplicate) {
    throw new Error(
      "Processed webhook was not detected as duplicate."
    );
  }

  const finalPromises =
    await prisma.promiseToPay.findMany({
      where: {
        recoveryCaseId:
          recoveryCase.id,
      },
    });

  if (finalPromises.length !== 1) {
    throw new Error(
      `Duplicate webhook created another PromiseToPay. Found ${finalPromises.length}`
    );
  }

  console.log(
    "\n✓ FAILED → retry → PROMISE_TO_PAY → PROCESSED passed"
  );

  console.log(
    "\n✓ Duplicate retry remained idempotent"
  );

  console.log(
    "\n✓ Isolated voice webhook retry integration test passed"
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\n✗ Isolated voice webhook retry test failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}