import "dotenv/config";

import { prisma } from "@recover-ai/database";

import { processWebhookRetries } from "../../workers/webhook-retry.worker.js";

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
      name: `Webhook Retry Success ${suffix}`,
      email: `retry-success-${suffix}@example.com`,
      phone: "+919999999999",
    },
  });

  const payment = await prisma.payment.create({
    data: {
      merchantId: merchant.id,
      customerId: customer.id,
      razorpayPaymentId: `pay_retry_${suffix}`,
      amount: 49900,
      currency: "INR",
      status: "FAILED",
      failureReason: "Retry success integration test",
    },
  });

  const orderId = `order_retry_${suffix}`;

  await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      status: "FAILED",
      failureReason: "Retry success integration test",
      razorpayOrderId: orderId,
    },
  });

  const recoveryCase =
    await prisma.recoveryCase.create({
      data: {
        merchantId: merchant.id,
        paymentId: payment.id,
        status: "IN_PROGRESS",
        amountAtRisk: payment.amount,
        failureReason: "Retry success integration test",
      },
    });

  const promise =
    await prisma.promiseToPay.create({
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
        notes: "Retry worker success test.",
      },
    });

  const eventId =
    `retry_success_${suffix}`;

  const webhookEvent =
    await prisma.webhookEvent.create({
      data: {
        eventId,
        eventType: "payment.captured",
        provider: "RAZORPAY",
        payload: {
          payload: {
            payment: {
              entity: {
                id: `pay_captured_${suffix}`,
                order_id: orderId,
                amount: payment.amount,
                currency: payment.currency,
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
    webhook: webhookEvent.status,
    payment: payment.status,
    promise: promise.status,
    recoveryCase: recoveryCase.status,
  });

  await processWebhookRetries();

  const updatedWebhook =
    await prisma.webhookEvent.findUnique({
      where: {
        id: webhookEvent.id,
      },
    });

  const updatedPayment =
    await prisma.payment.findUnique({
      where: {
        id: payment.id,
      },
    });

  const updatedPromise =
    await prisma.promiseToPay.findUnique({
      where: {
        id: promise.id,
      },
    });

  const updatedCase =
    await prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCase.id,
      },
    });

  console.log(
    "\n=== After retry ==="
  );

  console.log({
    webhook:
      updatedWebhook?.status,
    attempts:
      updatedWebhook?.processingAttempts,
    processed:
      updatedWebhook?.processed,
    payment:
      updatedPayment?.status,
    promise:
      updatedPromise?.status,
    recoveryCase:
      updatedCase?.status,
  });

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
    updatedWebhook.processingAttempts !==
    1
  ) {
    throw new Error(
      `Expected 1 processing attempt, got ${updatedWebhook.processingAttempts}`
    );
  }

  if (
    updatedPayment?.status !==
    "CAPTURED"
  ) {
    throw new Error(
      `Expected payment CAPTURED, got ${updatedPayment?.status}`
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

  if (
    updatedCase?.status !==
    "RECOVERED"
  ) {
    throw new Error(
      `Expected RecoveryCase RECOVERED, got ${updatedCase?.status}`
    );
  }

  console.log(
    "\n✓ Webhook successful retry integration test passed"
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\n✗ Webhook successful retry test failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}