import "dotenv/config";

import { prisma } from "@recover-ai/database";

import {
  processVoiceRecoveryOutcome,
} from "../../recovery/voice-outcome.service.js";

async function createTestRecoveryCase() {
  const merchant = await prisma.merchant.findFirst();

  if (!merchant) {
    throw new Error("No merchant found.");
  }

  const customer = await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      name: `Voice Outcome Test ${Date.now()}`,
      email: `voice-outcome-${Date.now()}@example.com`,
      phone: "+919999999999",
    },
  });

  const payment = await prisma.payment.create({
    data: {
      merchantId: merchant.id,
      customerId: customer.id,
      razorpayPaymentId:
        `pay_voice_outcome_${Date.now()}`,
      amount: 49900,
      currency: "INR",
      status: "FAILED",
      failureReason:
        "Voice outcome integration test",
    },
  });

  const recoveryCase =
    await prisma.recoveryCase.create({
      data: {
        merchantId: merchant.id,
        paymentId: payment.id,
        status: "OPEN",
        amountAtRisk: payment.amount,
        failureReason:
          "Voice outcome integration test",
      },
    });

  const voiceCall = await prisma.voiceCall.create({
    data: {
      recoveryCaseId: recoveryCase.id,
      provider: "MOCK",
      providerCallId:
        `test_voice_call_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}`,
      status: "COMPLETED",
      phoneNumber: customer.phone ?? "+919999999999",
    },
  });

  return {
    merchant,
    customer,
    payment,
    recoveryCase,
    voiceCall,
  };
}

async function testPromiseToPay() {
  const { recoveryCase, voiceCall } =
    await createTestRecoveryCase();

  const promisedFor = new Date(
    Date.now() + 24 * 60 * 60 * 1000
  );

  await processVoiceRecoveryOutcome(
    recoveryCase.id,
    voiceCall.id,
    {
      outcome: "PROMISE_TO_PAY",
      confidence: 0.99,
      summary:
        "Customer promised to pay tomorrow.",
      promisedFor,
      notes:
        "Customer promised payment tomorrow.",
    }
  );

  const updatedCase =
    await prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCase.id,
      },
    });

  const promise =
    await prisma.promiseToPay.findFirst({
      where: {
        recoveryCaseId: recoveryCase.id,
      },
    });

  if (updatedCase?.status !== "IN_PROGRESS") {
    throw new Error(
      `Expected IN_PROGRESS, got ${updatedCase?.status}`
    );
  }

  if (!promise) {
    throw new Error(
      "Expected PromiseToPay to be created."
    );
  }

  if (promise.status !== "PENDING") {
    throw new Error(
      `Expected PENDING promise, got ${promise.status}`
    );
  }

  if (promise.source !== "VOICE") {
    throw new Error(
      `Expected VOICE source, got ${promise.source}`
    );
  }

  console.log(
    "✓ PROMISE_TO_PAY integration test passed"
  );
}

async function testDeclined() {
  const { recoveryCase, voiceCall } =
    await createTestRecoveryCase();

  await processVoiceRecoveryOutcome(
    recoveryCase.id,
    voiceCall.id,
    {
      outcome: "DECLINED",
      confidence: 0.95,
      summary:
        "Customer declined to pay.",
    }
  );

  const updatedCase =
    await prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCase.id,
      },
    });

  if (updatedCase?.status !== "ESCALATED") {
    throw new Error(
      `Expected ESCALATED, got ${updatedCase?.status}`
    );
  }

  console.log(
    "✓ DECLINED integration test passed"
  );
}

async function testNoResponse() {
  const { recoveryCase, voiceCall } =
    await createTestRecoveryCase();

  await processVoiceRecoveryOutcome(
    recoveryCase.id,
    voiceCall.id,
    {
      outcome: "NO_RESPONSE",
      confidence: 1,
      summary:
        "Customer did not respond.",
    }
  );

  const updatedCase =
    await prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCase.id,
      },
    });

  if (updatedCase?.status !== "IN_PROGRESS") {
    throw new Error(
      `Expected IN_PROGRESS, got ${updatedCase?.status}`
    );
  }

  console.log(
    "✓ NO_RESPONSE integration test passed"
  );
}

async function run() {
  console.log(
    "\n=== Voice Recovery Outcome Integration Tests ==="
  );

  await testPromiseToPay();
  await testDeclined();
  await testNoResponse();

  console.log(
    "\nAll voice outcome integration tests passed."
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\nVoice outcome integration tests failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}