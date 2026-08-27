import { prisma } from "@recover-ai/database";

import {
  mockNotificationProvider,
} from "../../providers/notifications/mock-notification.provider.js";

import type {
  ActionExecutionResult,
} from "../action-executor.types.js";

export async function executeSendNotification(
  actionId: string
): Promise<ActionExecutionResult> {
  console.log(
    `Executing SEND_NOTIFICATION action: ${actionId}`
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

  const recoveryCase = action.recoveryCase;
  const payment = recoveryCase.payment;
  const customer = payment.customer;

  if (payment.status === "CAPTURED") {
    throw new Error(
      "Cannot send recovery notification for a captured payment"
    );
  }

  if (!customer) {
    throw new Error(
      "Cannot send recovery notification: customer not found"
    );
  }

  /*
   * Read notification configuration from the action payload.
   *
   * Example:
   *
   * {
   *   channel: "SMS",
   *   recipient: "9876543210",
   *   message: "Your payment could not be completed..."
   * }
   */

  const payload =
    action.payload &&
    typeof action.payload === "object" &&
    !Array.isArray(action.payload)
      ? action.payload as {
          channel?: unknown;
          recipient?: unknown;
          message?: unknown;
        }
      : {};

  const channel =
    payload.channel === "SMS" ||
    payload.channel === "EMAIL" ||
    payload.channel === "WHATSAPP"
      ? payload.channel
      : "SMS";

  const recipient =
    typeof payload.recipient === "string" &&
    payload.recipient.length > 0
      ? payload.recipient
      : customer.phone ??
        customer.email;

  if (!recipient) {
    throw new Error(
      "Customer does not have a phone number or email address"
    );
  }

  const message =
    typeof payload.message === "string" &&
    payload.message.length > 0
      ? payload.message
      : `Your payment of ${payment.amount / 100} ${payment.currency} could not be completed. Please complete your payment to continue.`;

  const result =
    await mockNotificationProvider.send({
      recoveryCaseId:
        recoveryCase.id,

      paymentId:
        payment.id,

      channel,

      recipient,

      message,
    });

  if (!result.success) {
    throw new Error(
      result.error ||
        "Failed to send recovery notification"
    );
  }

  if (!result.externalProviderId) {
    throw new Error(
      "Notification sent but no provider ID was returned"
    );
  }

  return {
    success: true,
    action: "SEND_NOTIFICATION",
    externalProviderId:
      result.externalProviderId,

    ...(result.result !== undefined
      ? {
          result:
            result.result as any,
        }
      : {}),
  };
}