import { prisma } from "@recover-ai/database";
import { executeRetryPayment } from "./handlers/retry-payment.handler.js";
import type { ActionExecutionResult } from "./action-executor.types.js";
import { executeCreatePaymentLink } from "./handlers/create-payment-link.handler.js";
import {
  executeSendNotification,
} from "./handlers/send-notification.handler.js";
import {
  executeWait,
} from "./handlers/wait.handler.js";
import {
  executeEscalate,
} from "./handlers/escalate.handler.js";


export async function executeRecoveryAction(
  actionId: string
): Promise<ActionExecutionResult> {
  const action = await prisma.recoveryAction.findUnique({
    where: {
      id: actionId,
    },
  });

  if (!action) {
    throw new Error(
      `Recovery action not found: ${actionId}`
    );
  }

  if (action.status !== "APPROVED") {
    throw new Error(
      `Recovery action is not approved: ${actionId}`
    );
  }

  /*
   * Idempotency protection.
   *
   * An already executed action must never be executed again.
   */

  if (action.executedAt) {
    return {
      success: true,
      action: action.type,
      result: {
        message: "Retry payment exection simulated",
        actionId,
      }
    };
  }

  /*
   * Mark the action as executing.
   */

  await prisma.recoveryAction.update({
    where: {
      id: action.id,
    },
    data: {
      status: "EXECUTING",
    },
  });

  try {
    let result: ActionExecutionResult;

    switch (action.type) {
      case "RETRY_PAYMENT":
        result = await executeRetryPayment(action.id);
        break;

      case "CREATE_PAYMENT_LINK":
      result = await executeCreatePaymentLink(action.id);
           break;

      case "SEND_NOTIFICATION":
          result = await executeSendNotification(
          action.id
       );
         break;

      case "WAIT":
            result = await executeWait(action.id);
            break;

      case "ESCALATE":
        result = await executeEscalate(action.id);
        break;

      default:
        throw new Error(
          `Unsupported recovery action: ${action.type}`
        );
    }

    if (!result.success) {
      throw new Error(
        result.error || "Recovery action failed"
      );
    }

  const updateData = {
  status: "COMPLETED" as const,
  executedAt: new Date(),
  error: null,
  ...(result.result !== undefined
    ? { result: result.result }
    : {}),
  ...(result.externalProviderId !== undefined
    ? {
        externalProviderId:
          result.externalProviderId,
      }
    : {}),
};

await prisma.recoveryAction.update({
  where: {
    id: action.id,
  },
  data: updateData,
});

  return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown action execution error";

    await prisma.recoveryAction.update({
      where: {
        id: action.id,
      },
      data: {
        status: "FAILED",
        error: errorMessage,
      },
    });

    throw error;
  }
}