import "dotenv/config";

import { prisma } from "@recover-ai/database";
import { handlePaymentCaptured } from "../../events/handlers/payment-captured.handler.js";

async function run() {
  const merchant = await prisma.merchant.findFirst();

  if (!merchant) {
    throw new Error("No merchant found.");
  }

  const suffix =
    `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

  /*
   * Create an isolated customer.
   */
  const customer =
    await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        name: `Payment Captured Test ${suffix}`,
        email: `payment-captured-${suffix}@example.com`,
        phone: "+919999999999",
      },
    });

  /*
   * Create a failed payment.
   */
  const payment =
    await prisma.payment.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,
        razorpayPaymentId:
          `pay_failed_${suffix}`,
        amount: 49900,
        currency: "INR",
        status: "FAILED",
        failureReason:
          "Payment captured integration test",
      },
    });

  /*
   * Create the Razorpay order/payment attempt
   * required by the capture handler.
   */
  const orderId =
    `order_test_${suffix}`;

  const attempt =
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        status: "FAILED",
        failureReason:
          "Payment captured integration test",
        razorpayOrderId: orderId,
      },
    });

  /*
   * Create the recovery case.
   */
  const recoveryCase =
    await prisma.recoveryCase.create({
      data: {
        merchantId: merchant.id,
        paymentId: payment.id,
        status: "IN_PROGRESS",
        amountAtRisk: payment.amount,
        failureReason:
          "Payment captured integration test",
      },
    });

  /*
   * Create the pending PromiseToPay.
   */
  const promise =
    await prisma.promiseToPay.create({
      data: {
        recoveryCaseId:
          recoveryCase.id,
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        promisedFor: new Date(
          Date.now() +
            24 * 60 * 60 * 1000
        ),
        status: "PENDING",
        source: "MANUAL",
        notes:
          "Customer promised payment before capture.",
      },
    });

  console.log(
    "\n=== Before payment.captured ==="
  );

  console.log({
    paymentStatus:
      payment.status,
    recoveryCaseStatus:
      recoveryCase.status,
    promiseStatus:
      promise.status,
    attemptStatus:
      attempt.status,
    razorpayOrderId:
      attempt.razorpayOrderId,
  });

  /*
   * Simulate Razorpay payment.captured webhook.
   */
  const razorpayPaymentId =
    `pay_captured_${suffix}`;

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

  const updatedPromise =
    await prisma.promiseToPay.findUnique({
      where: {
        id: promise.id,
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

  console.log(
    "\n=== After payment.captured ==="
  );

  console.log({
    paymentStatus:
      updatedPayment?.status,
    attemptStatus:
      updatedAttempt?.status,
    recoveryCaseStatus:
      updatedCase?.status,
    promiseStatus:
      updatedPromise?.status,
    fulfilledAt:
      updatedPromise?.fulfilledAt,
    amountRecovered:
      updatedCase?.amountRecovered,
  });

  /*
   * Assertions.
   */
  if (
    updatedPayment?.status !==
    "CAPTURED"
  ) {
    throw new Error(
      `Expected payment CAPTURED, got ${updatedPayment?.status}`
    );
  }

  if (
    updatedAttempt?.status !==
    "CAPTURED"
  ) {
    throw new Error(
      `Expected attempt CAPTURED, got ${updatedAttempt?.status}`
    );
  }

  if (
    updatedPromise?.status !==
    "FULFILLED"
  ) {
    throw new Error(
      `Expected PromiseToPay FULFILLED, got ${updatedPromise?.status}`
    );
  }

  if (!updatedPromise.fulfilledAt) {
    throw new Error(
      "Expected fulfilledAt to be set."
    );
  }

  if (
    updatedCase?.status !==
    "RECOVERED"
  ) {
    throw new Error(
      `Expected RecoveryCase RECOVERED, got ${updatedCase?.status}`
    );
  }

  if (
    updatedCase.amountRecovered !==
    payment.amount
  ) {
    throw new Error(
      `Expected amountRecovered ${payment.amount}, got ${updatedCase.amountRecovered}`
    );
  }

  /*
   * Duplicate payment.captured must be harmless.
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

  if (
    finalPromise?.status !==
    "FULFILLED"
  ) {
    throw new Error(
      "Duplicate payment capture changed PromiseToPay state."
    );
  }

  console.log(
    "\n✓ Payment captured → PromiseToPay fulfilled → RecoveryCase recovered passed"
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\n✗ Payment captured integration test failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}