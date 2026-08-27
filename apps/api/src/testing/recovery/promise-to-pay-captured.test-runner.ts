import "dotenv/config";

import { prisma } from "@recover-ai/database";
import { handlePaymentCaptured } from "../../events/handlers/payment-captured.handler.js";

const recoveryCaseId = process.argv[2];

if (!recoveryCaseId) {
  throw new Error(
    "Usage: npx tsx src/recovery/promise-to-pay-captured.test-runner.ts <recoveryCaseId>"
  );
}

const recoveryCase =
  await prisma.recoveryCase.findUnique({
    where: {
      id: recoveryCaseId,
    },
    include: {
      payment: true,
    },
  });

if (!recoveryCase) {
  throw new Error(
    `Recovery case not found: ${recoveryCaseId}`
  );
}

const promise =
  await prisma.promiseToPay.findFirst({
    where: {
      recoveryCaseId,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

if (!promise) {
  throw new Error(
    "No PENDING PromiseToPay found for this recovery case"
  );
}

const attempt =
  await prisma.paymentAttempt.findFirst({
    where: {
      paymentId: recoveryCase.paymentId,
    },
    orderBy: {
      attemptNumber: "desc",
    },
  });

if (!attempt) {
  throw new Error(
    "No payment attempt found"
  );
}

if (!attempt.razorpayOrderId) {
  throw new Error(
    "Payment attempt does not have a Razorpay order ID"
  );
}

if (
  recoveryCase.payment.status === "CAPTURED"
) {
  throw new Error(
    "Payment is already CAPTURED. Use a fresh failed recovery case for this test."
  );
}

console.log("\nBefore payment.captured:");
console.log({
  paymentStatus:
    recoveryCase.payment.status,
  recoveryCaseStatus:
    recoveryCase.status,
  promiseStatus:
    promise.status,
  razorpayOrderId:
    attempt.razorpayOrderId,
});

const payload = {
  event: "payment.captured",

  payload: {
    payment: {
      entity: {
        id: `pay_test_${Date.now()}`,
        order_id: attempt.razorpayOrderId,
        amount: recoveryCase.payment.amount,
        currency: recoveryCase.payment.currency,
      },
    },
  },
};

await handlePaymentCaptured(payload);

const updatedPromise =
  await prisma.promiseToPay.findUnique({
    where: {
      id: promise.id,
    },
  });

const updatedPayment =
  await prisma.payment.findUnique({
    where: {
      id: recoveryCase.paymentId,
    },
  });

const updatedCase =
  await prisma.recoveryCase.findUnique({
    where: {
      id: recoveryCaseId,
    },
  });

console.log("\nAfter payment.captured:");

console.log({
  paymentStatus:
    updatedPayment?.status,

  recoveryCaseStatus:
    updatedCase?.status,

  promiseStatus:
    updatedPromise?.status,

  fulfilledAt:
    updatedPromise?.fulfilledAt,

  amountRecovered:
    updatedCase?.amountRecovered,
});

await prisma.$disconnect();