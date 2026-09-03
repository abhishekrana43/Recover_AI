import { prisma } from "@recover-ai/database";

import {
  razorpayPaymentProvider,
} from "../../providers/payments/razorpay.providers.js";

import {
  mockNotificationProvider,
} from "../../providers/notifications/mock-notification.provider.js";

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
            payment: {
              include: {
                customer: true,
              },
            },
          },
        },
      },
    });

  if (!action) {
    throw new Error(
      `Recovery action not found: ${actionId}`
    );
  }

  const recoveryCase =
    action.recoveryCase;

  const payment =
    recoveryCase.payment;

  const customer =
    payment.customer;

  /*
   * A payment link should only be created
   * for a payment that still needs recovery.
   */
  if (payment.status === "CAPTURED") {
    throw new Error(
      "Cannot create payment link for a captured payment"
    );
  }

  if (!customer) {
    throw new Error(
      "Cannot create payment link: customer not found"
    );
  }

  /*
   * The customer must have at least one
   * available contact method.
   */
  // if (!customer.phone && !customer.email) {
  //   throw new Error(
  //     "Customer does not have a phone number or email address"
  //   );
  // }

  /*
   * Create the payment link through Razorpay.
   */
  const result =
    await razorpayPaymentProvider.createPaymentLink({
      recoveryCaseId:
        recoveryCase.id,

      paymentId:
        payment.id,

      amount:
        payment.amount,

      currency:
        payment.currency,
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

  if (!result.shortUrl) {
    throw new Error(
      "Payment link created but no customer-facing URL was returned"
    );
  }

  /*
   * Use SMS when a phone number exists.
   * Otherwise fall back to email.
   */
  // const channel =
  //   customer.phone
  //     ? "SMS"
  //     : "EMAIL";

  // const recipient =
  //   customer.phone ??
  //   customer.email;
  const recipient =
  customer.phone
    ? customer.phone
    : customer.email;

if (!recipient) {
  throw new Error(
    "Customer does not have a phone number or email address"
  );
}

const channel =
  customer.phone
    ? "SMS"
    : "EMAIL";

  const message =
    `Your payment of ${
      payment.amount / 100
    } ${
      payment.currency
    } could not be completed. Please complete your payment using this link: ${
      result.shortUrl
    }`;

  /*
   * Create a separate notification action so
   * the payment-link delivery is also visible
   * in the recovery action history.
   */
  const notification =
    await prisma.recoveryAction.create({
      data: {
        recoveryCaseId:
          recoveryCase.id,

        type:
          "SEND_NOTIFICATION",

        status:
          "APPROVED",

        approvalRequired:
          false,

        approvedAt:
          new Date(),

        approvalReason:
          "Automatic payment-link delivery",

        payload: {
          channel,
          recipient,
          message,
        },
      },
    });

  /*
   * Send the notification through the
   * configured notification provider.
   *
   * Currently this project uses the mock
   * notification provider for delivery.
   */
  const notificationResult =
    await mockNotificationProvider.send({
      recoveryCaseId:
        recoveryCase.id,

      paymentId:
        payment.id,

      channel,

      recipient,

      message,
    });

  if (!notificationResult.success) {
    await prisma.recoveryAction.update({
      where: {
        id: notification.id,
      },

      data: {
        status:
          "FAILED",

        error:
          notificationResult.error ??
          "Failed to send payment-link notification",
      },
    });

    throw new Error(
      notificationResult.error ??
        "Failed to send payment-link notification"
    );
  }

  /*
   * Mark the notification action as completed.
   */
  await prisma.recoveryAction.update({
    where: {
      id: notification.id,
    },

    data: {
      status:
        "COMPLETED",

      executedAt:
        new Date(),

      ...(notificationResult.externalProviderId !==
      undefined
        ? {
            externalProviderId:
              notificationResult.externalProviderId,
          }
        : {}),

      ...(notificationResult.result !==
      undefined
        ? {
            result:
              notificationResult.result,
          }
        : {}),
    },
  });

  /*
   * The main action executor persists:
   *
   * - COMPLETED
   * - executedAt
   * - externalProviderId
   * - result
   *
   * for CREATE_PAYMENT_LINK.
   */
  // return {
  //   success: true,

  //   action:
  //     "CREATE_PAYMENT_LINK",

  //   externalProviderId:
  //     result.providerPaymentLinkId,

  //   result: {
  //     ...(result.result ?? {}),

  //     notificationActionId:
  //       notification.id,

  //     notificationProviderId:
  //       notificationResult.externalProviderId,

  //     notificationChannel:
  //       channel,

  //     notificationRecipient:
  //       recipient,
  //   },

    
  // };

  return {
  success: true,
  action: "CREATE_PAYMENT_LINK",

  externalProviderId:
    result.providerPaymentLinkId,

  result: {
    paymentLinkId:
      result.providerPaymentLinkId,

    shortUrl:
      result.shortUrl,

    amount:
      payment.amount,

    currency:
      payment.currency,

    notificationActionId:
      notification.id,

    notificationProviderId:
      notificationResult.externalProviderId,

    notificationChannel:
      channel,

    notificationRecipient:
      recipient,
  },
 };
}