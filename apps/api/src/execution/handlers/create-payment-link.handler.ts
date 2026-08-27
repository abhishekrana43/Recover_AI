import { prisma } from "@recover-ai/database";

import {
  razorpayPaymentProvider,
} from "../../providers/payments/razorpay.providers.js";

import type {
  ActionExecutionResult,
} from "../action-executor.types.js";

export async function executeCreatePaymentLink(
  actionId: string
): Promise<ActionExecutionResult> {
  console.log(
    `Executing CREATE_PAYMENT_LINK action: ${actionId}`
  );

  const action =
    await prisma.recoveryAction.findUnique({
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

  /*
   * A payment link should only be created for a
   * payment that still needs recovery.
   */
  if (payment.status === "CAPTURED") {
    throw new Error(
      "Cannot create payment link for a captured payment"
    );
  }

  /*
   * Create the payment link through the provider.
   */
  const result =
    await razorpayPaymentProvider.createPaymentLink({
      recoveryCaseId: action.recoveryCaseId,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
    });

  if (!result.success) {
    throw new Error(
      result.error ||
        "Failed to create Razorpay payment link"
    );
  }

  if (!result.providerPaymentLinkId) {
    throw new Error(
      "Payment link created but no provider ID was returned"
    );
  }

  /*
   * The action executor is responsible for persisting:
   *
   * - COMPLETED
   * - executedAt
   * - externalProviderId
   * - result
   *
   * Therefore this handler only returns the result.
   */
  return {
    success: true,
    action: "CREATE_PAYMENT_LINK",
    externalProviderId:
      result.providerPaymentLinkId,

    ...(result.result !== undefined
      ? {
          result: result.result,
        }
      : {}),
  };
}