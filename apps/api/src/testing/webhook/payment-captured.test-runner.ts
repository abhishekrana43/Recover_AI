import "dotenv/config";

import { prisma } from "@recover-ai/database";

import { handlePaymentCaptured } from "../../events/handlers/payment-captured.handler.js";

async function run() {
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
      name: `Payment Capture Test ${suffix}`,
      email: `payment-capture-${suffix}@example.com`,
      phone: "+919999999999",
    },
  });

  const payment = await prisma.payment.create({
    data: {
      merchantId: merchant.id,
      customerId: customer.id,
      razorpayPaymentId: `pay_failed_${suffix}`,
      amount: 49900,
      currency: "INR",
      status: "FAILED",
      failureReason: "Payment capture integration test",
    },
  });

  const orderId = `order_test_${suffix}`;

  const attempt = await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      status: "FAILED",
      failureReason: "Payment capture integration test",
      razorpayOrderId: orderId,
    },
  });

  const recoveryCase = await prisma.recoveryCase.create({
    data: {
      merchantId: merchant.id,
      paymentId: payment.id,
      status: "IN_PROGRESS",
      amountAtRisk: payment.amount,
      failureReason: "Payment capture integration test",
    },
  });

  const promise = await prisma.promiseToPay.create({
    data: {
      recoveryCaseId: recoveryCase.id,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      promisedFor: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ),
      status: "PENDING",
      source: "VOICE",
      notes: "Customer promised to pay tomorrow.",
    },
  });

  console.log("\n=== Before payment.captured ===");

  console.log({
    payment: payment.status,
    attempt: attempt.status,
    recoveryCase: recoveryCase.status,
    promise: promise.status,
  });

  const razorpayPaymentId = `pay_capture_${suffix}`;

  await handlePaymentCaptured({
    payload: {
      payment: {
        entity: {
          id: razorpayPaymentId,
          order_id: orderId,
          amount: payment.amount,
          currency: payment.currency,
        },
      },
    },
  });

  const updatedPayment =
    await prisma.payment.findUnique({
      where: {
        id: payment.id,
      },
    });

  const updatedAttempt =
    await prisma.paymentAttempt.findUnique({
      where: {
        id: attempt.id,
      },
    });

  const updatedCase =
    await prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCase.id,
      },
    });

  const updatedPromise =
    await prisma.promiseToPay.findUnique({
      where: {
        id: promise.id,
      },
    });

  console.log("\n=== After payment.captured ===");

  console.log({
    payment: updatedPayment?.status,
    attempt: updatedAttempt?.status,
    recoveryCase: updatedCase?.status,
    promise: updatedPromise?.status,
    fulfilledAt: updatedPromise?.fulfilledAt,
    resolvedAt: updatedCase?.resolvedAt,
  });

  if (updatedPayment?.status !== "CAPTURED") {
    throw new Error(
      `Expected payment CAPTURED, got ${updatedPayment?.status}`
    );
  }

  if (updatedAttempt?.status !== "CAPTURED") {
    throw new Error(
      `Expected attempt CAPTURED, got ${updatedAttempt?.status}`
    );
  }

  if (updatedPromise?.status !== "FULFILLED") {
    throw new Error(
      `Expected PromiseToPay FULFILLED, got ${updatedPromise?.status}`
    );
  }

  if (!updatedPromise.fulfilledAt) {
    throw new Error(
      "Expected PromiseToPay fulfilledAt to be set."
    );
  }

  if (updatedCase?.status !== "RECOVERED") {
    throw new Error(
      `Expected RecoveryCase RECOVERED, got ${updatedCase?.status}`
    );
  }

  if (!updatedCase.resolvedAt) {
    throw new Error(
      "Expected RecoveryCase resolvedAt to be set."
    );
  }

  /*
   * Duplicate payment.captured should be harmless.
   */
  await handlePaymentCaptured({
    payload: {
      payment: {
        entity: {
          id: razorpayPaymentId,
          order_id: orderId,
          amount: payment.amount,
          currency: payment.currency,
        },
      },
    },
  });

  const finalPromise =
    await prisma.promiseToPay.findUnique({
      where: {
        id: promise.id,
      },
    });

  if (finalPromise?.status !== "FULFILLED") {
    throw new Error(
      "Duplicate capture changed PromiseToPay state."
    );
  }

  console.log(
    "\n✓ Payment capture → PromiseToPay fulfillment → RecoveryCase recovery passed"
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\n✗ Payment capture integration test failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}