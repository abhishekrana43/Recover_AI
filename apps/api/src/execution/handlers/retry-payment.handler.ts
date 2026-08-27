import { prisma } from "@recover-ai/database";

import { razorpayPaymentProvider } from "../../providers/payments/razorpay.providers.js";

import type { ActionExecutionResult } from "../action-executor.types.js";

export async function executeRetryPayment(
  actionId: string
): Promise<ActionExecutionResult> {
  console.log(
    `Executing RETRY_PAYMENT action: ${actionId}`
  );

  const action = await prisma.recoveryAction.findUnique({
    where: {
      id: actionId,
    },
    include: {
      recoveryCase: {
        include: {
          payment: true,
        },
      },
    },
  });

  if (!action) {
    throw new Error(
      `Recovery action not found: ${actionId}`
    );
  }

  const payment = action.recoveryCase.payment;

  const result =
    await razorpayPaymentProvider.retryPayment({
      recoveryCaseId: action.recoveryCaseId,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
    });

  if (!result.success) {
    throw new Error(
      result.error ||
        "Razorpay retry payment failed"
    );
  }

  if (!result.providerOrderId) {
  throw new Error(
    "Razorpay order was created but no order ID was returned"
  );
}

const latestAttempt =
  await prisma.paymentAttempt.findFirst({
    where: {
      paymentId: payment.id,
    },
    orderBy: {
      attemptNumber: "desc",
    },
    select: {
      attemptNumber: true,
    },
  });

const attemptNumber =
  (latestAttempt?.attemptNumber ?? 0) + 1;

await prisma.paymentAttempt.create({
  data: {
    paymentId: payment.id,
    attemptNumber,
    status: "CREATED",
    razorpayOrderId: result.providerOrderId,
  },
});

return {
  success: true,
  action: "RETRY_PAYMENT",
  externalProviderId: result.providerOrderId,
  ...(result.result !== undefined
    ? { result: result.result }
    : {}),
};
  
}