import "dotenv/config";

import { prisma } from "@recover-ai/database";

import { createPromiseToPay } from "../../recovery/promise-to-pay.service.js";
import { handlePaymentCaptured } from "../../events/handlers/payment-captured.handler.js";
import { createRecoveryAction } from "../../services/recovery-action.service.js";
import { executeRecoveryAction } from "../../execution/action-executor.service.js";
import { handleVoiceWebhook } from "../../events/voice-webhook-idempotency.service.js";

async function run() {
  console.log("\n========================================");
  console.log("   RECOVER-AI FULL E2E RECOVERY TEST");
  console.log("========================================\n");

  /*
   * -------------------------------------------------------
   * 1. Find merchant
   * -------------------------------------------------------
   */

  const merchant = await prisma.merchant.findFirst();

  if (!merchant) {
    throw new Error("No merchant found.");
  }

  const suffix =
    `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

  /*
   * -------------------------------------------------------
   * 2. Create isolated customer
   * -------------------------------------------------------
   */

  const customer =
    await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        name: `E2E Recovery Test ${suffix}`,
        email: `e2e-${suffix}@example.com`,
        phone: "+919999999999",
      },
    });

  /*
   * -------------------------------------------------------
   * 3. Create failed payment
   * -------------------------------------------------------
   */

  const payment =
    await prisma.payment.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,
        razorpayPaymentId:
          `pay_e2e_failed_${suffix}`,
        amount: 49900,
        currency: "INR",
        status: "FAILED",
        failureReason:
          "Full E2E recovery test",
      },
    });

  /*
   * -------------------------------------------------------
   * 4. Create failed payment attempt
   * -------------------------------------------------------
   */

  const orderId =
    `order_e2e_${suffix}`;

  const attempt =
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        status: "FAILED",
        failureReason:
          "Full E2E recovery test",
        razorpayOrderId: orderId,
      },
    });

  /*
   * -------------------------------------------------------
   * 5. Create recovery case
   * -------------------------------------------------------
   */

  const recoveryCase =
    await prisma.recoveryCase.create({
      data: {
        merchantId: merchant.id,
        paymentId: payment.id,
        status: "IN_PROGRESS",
        amountAtRisk: payment.amount,
        failureReason:
          "Full E2E recovery test",
      },
    });

  console.log("Created E2E scenario:");
  console.log({
    customerId: customer.id,
    paymentId: payment.id,
    paymentAttemptId: attempt.id,
    recoveryCaseId: recoveryCase.id,
  });

  /*
   * -------------------------------------------------------
   * 6. Evaluate recovery policy
   * -------------------------------------------------------
   */

  const actionResult =
    await createRecoveryAction(
      recoveryCase.id,
      "VOICE_RECOVERY"
    );

  console.log("\n=== POLICY ===");

  console.log({
    decision:
      actionResult.policyResult.decision,

    approvalRequired:
      actionResult.policyResult.approvalRequired,

    reason:
      actionResult.policyResult.reason,

    action:
      actionResult.action.type,

    actionStatus:
      actionResult.action.status,
  });

  if (
    actionResult.policyResult.decision !==
    "ALLOW"
  ) {
    throw new Error(
      `Expected policy ALLOW, got ${actionResult.policyResult.decision}`
    );
  }

  /*
   * -------------------------------------------------------
   * 7. Execute voice recovery action
   * -------------------------------------------------------
   */

  const executed =
    await executeRecoveryAction(
      actionResult.action.id
    );

  console.log("\n=== VOICE RECOVERY ===");

  console.log(executed);

  if (!executed.success) {
    throw new Error(
      "VOICE_RECOVERY execution failed."
    );
  }

  /*
   * -------------------------------------------------------
   * 8. Get created VoiceCall
   * -------------------------------------------------------
   */

  const voiceCall =
    await prisma.voiceCall.findFirst({
      where: {
        recoveryCaseId:
          recoveryCase.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  if (!voiceCall) {
    throw new Error(
      "VoiceCall was not created."
    );
  }

  console.log("\nVoiceCall created:");
  console.log({
    id: voiceCall.id,
    provider:
      voiceCall.provider,
    providerCallId:
      voiceCall.providerCallId,
    status:
      voiceCall.status,
  });

  /*
   * -------------------------------------------------------
   * 9. Simulate voice provider webhook
   * -------------------------------------------------------
   */

  const voiceEventId =
    `e2e_voice_${suffix}`;

  const voiceEvent = {
    eventId: voiceEventId,
    provider: voiceCall.provider,
    providerCallId:
      voiceCall.providerCallId,
    status: "COMPLETED" as const,
    transcript:
      "I will pay tomorrow.",
  };

  const voiceResult =
    await handleVoiceWebhook(
      voiceEvent,
      voiceEvent
    );

  console.log("\n=== VOICE WEBHOOK ===");

  console.log(voiceResult);

  if (voiceResult.duplicate) {
    throw new Error(
      "First voice webhook was incorrectly marked duplicate."
    );
  }

  /*
   * -------------------------------------------------------
   * 10. Verify PromiseToPay
   * -------------------------------------------------------
   */

  const promise =
    await prisma.promiseToPay.findFirst({
      where: {
        recoveryCaseId:
          recoveryCase.id,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  if (!promise) {
    throw new Error(
      "Expected PromiseToPay to be created."
    );
  }

  console.log("\n=== PROMISE TO PAY ===");

  console.log({
    id: promise.id,
    status:
      promise.status,
    source:
      promise.source,
    promisedFor:
      promise.promisedFor,
  });

  if (promise.status !== "PENDING") {
    throw new Error(
      `Expected PromiseToPay PENDING, got ${promise.status}`
    );
  }

  /*
   * -------------------------------------------------------
   * 11. Simulate Razorpay payment capture
   * -------------------------------------------------------
   */

  const capturedPaymentId =
    `pay_e2e_captured_${suffix}`;

  await handlePaymentCaptured({
    payload: {
      payment: {
        entity: {
          id:
            capturedPaymentId,
          order_id:
            orderId,
          amount:
            payment.amount,
          currency:
            payment.currency,
        },
      },
    },
  });

  /*
   * -------------------------------------------------------
   * 12. Read final state
   * -------------------------------------------------------
   */

  const finalPayment =
    await prisma.payment.findUnique({
      where: {
        id: payment.id,
      },
    });

  const finalAttempt =
    await prisma.paymentAttempt.findUnique({
      where: {
        id: attempt.id,
      },
    });

  const finalCase =
    await prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCase.id,
      },
    });

  const finalPromise =
    await prisma.promiseToPay.findUnique({
      where: {
        id: promise.id,
      },
    });

  console.log("\n========================================");
  console.log("             FINAL STATE");
  console.log("========================================\n");

  console.log({
    payment:
      finalPayment?.status,

    paymentAttempt:
      finalAttempt?.status,

    recoveryCase:
      finalCase?.status,

    amountAtRisk:
      finalCase?.amountAtRisk,

    amountRecovered:
      finalCase?.amountRecovered,

    promise:
      finalPromise?.status,

    fulfilledAt:
      finalPromise?.fulfilledAt,

    resolvedAt:
      finalCase?.resolvedAt,
  });

  /*
   * -------------------------------------------------------
   * 13. Assertions
   * -------------------------------------------------------
   */

  if (
    finalPayment?.status !==
    "CAPTURED"
  ) {
    throw new Error(
      `Expected payment CAPTURED, got ${finalPayment?.status}`
    );
  }

  if (
    finalAttempt?.status !==
    "CAPTURED"
  ) {
    throw new Error(
      `Expected payment attempt CAPTURED, got ${finalAttempt?.status}`
    );
  }

  if (
    finalPromise?.status !==
    "FULFILLED"
  ) {
    throw new Error(
      `Expected PromiseToPay FULFILLED, got ${finalPromise?.status}`
    );
  }

  if (!finalPromise.fulfilledAt) {
    throw new Error(
      "Expected fulfilledAt to be set."
    );
  }

  if (
    finalCase?.status !==
    "RECOVERED"
  ) {
    throw new Error(
      `Expected RecoveryCase RECOVERED, got ${finalCase?.status}`
    );
  }

  if (
    finalCase.amountRecovered !==
    payment.amount
  ) {
    throw new Error(
      `Expected amountRecovered ${payment.amount}, got ${finalCase.amountRecovered}`
    );
  }

  if (!finalCase.resolvedAt) {
    throw new Error(
      "Expected RecoveryCase resolvedAt to be set."
    );
  }

  /*
   * -------------------------------------------------------
   * 14. Verify audit trail
   * -------------------------------------------------------
   */

  const auditLogs =
    await prisma.auditLog.findMany({
      where: {
        entityType: "RecoveryCase",
        entityId:
          recoveryCase.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

  if (auditLogs.length === 0) {
    throw new Error(
      "Expected audit trail entries."
    );
  }

  console.log("\nAudit entries:");

  for (const log of auditLogs) {
    console.log({
      action: log.action,
      source: log.source,
      createdAt:
        log.createdAt,
    });
  }

  /*
   * -------------------------------------------------------
   * 15. Verify duplicate voice webhook
   * -------------------------------------------------------
   */

  const duplicateVoiceResult =
    await handleVoiceWebhook(
      voiceEvent,
      voiceEvent
    );

  if (
    !duplicateVoiceResult.duplicate
  ) {
    throw new Error(
      "Duplicate voice webhook was not detected."
    );
  }

  /*
   * -------------------------------------------------------
   * SUCCESS
   * -------------------------------------------------------
   */

  console.log(
    "\n✓ FULL E2E RECOVERY FLOW PASSED"
  );

  console.log(
    "\nFAILED PAYMENT"
  );

  console.log(
    "  ↓"
  );

  console.log(
    "RecoveryCase IN_PROGRESS"
  );

  console.log(
    "  ↓"
  );

  console.log(
    "Policy ALLOW"
  );

  console.log(
    "  ↓"
  );

  console.log(
    "VOICE_RECOVERY"
  );

  console.log(
    "  ↓"
  );

  console.log(
    "Voice webhook"
  );

  console.log(
    "  ↓"
  );

  console.log(
    "PromiseToPay PENDING"
  );

  console.log(
    "  ↓"
  );

  console.log(
    "Payment CAPTURED"
  );

  console.log(
    "  ↓"
  );

  console.log(
    "PromiseToPay FULFILLED"
  );

  console.log(
    "  ↓"
  );

  console.log(
    "RecoveryCase RECOVERED"
  );

  console.log(
    `  ↓\n₹${payment.amount / 100} recovered`
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\n✗ FULL E2E RECOVERY FLOW FAILED:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}