import { prisma } from "@recover-ai/database";

import {
  executeRetryPayment,
} from "./handlers/retry-payment.handler.js";

import type {
  ActionExecutionResult,
} from "./action-executor.types.js";

import {
  executeCreatePaymentLink,
} from "./handlers/create-payment-link.handler.js";

import {
  executeSendNotification,
} from "./handlers/send-notification.handler.js";

import {
  executeWait,
} from "./handlers/wait.handler.js";

import {
  executeEscalate,
} from "./handlers/escalate.handler.js";

import {
  executeVoiceRecovery,
} from "./handlers/voice-recovery.handler.js";

const LOCK_TIMEOUT_MS = 60_000;

export async function executeRecoveryAction(
  actionId: string
): Promise<ActionExecutionResult> {
  const action =
    await prisma.recoveryAction.findUnique({
      where: {
        id: actionId,
      },
    });

  if (!action) {
    throw new Error(
      `Recovery action not found: ${actionId}`
    );
  }

  /*
   * Idempotency protection.
   *
   * If this action has already been executed,
   * never execute it again.
   */
  if (action.executedAt) {
    return {
      success: true,
      action: action.type,
      result: {
        message:
          "Recovery action already executed",
        actionId,
      },
    };
  }

  /*
   * Only APPROVED actions can enter execution.
   */
  if (action.status !== "APPROVED") {
    throw new Error(
      `Recovery action is not approved: ${actionId}`
    );
  }

  /*
   * Atomically claim the action.
   *
   * This is important when multiple API instances or
   * worker processes are running. Only one process can
   * transition APPROVED -> EXECUTING.
   */
  const claimed =
    await prisma.recoveryAction.updateMany({
      where: {
        id: action.id,

        status: "APPROVED",

        executedAt: null,

        OR: [
          {
            lockedAt: null,
          },
          {
            lockedAt: {
              lt: new Date(
                Date.now() -
                  LOCK_TIMEOUT_MS
              ),
            },
          },
        ],
      },

      data: {
        status: "EXECUTING",
        lockedAt: new Date(),
      },
    });

  /*
   * Another worker already claimed the action.
   */
  if (claimed.count !== 1) {
    return {
      success: true,
      action: action.type,
      result: {
        message:
          "Recovery action was already claimed by another worker",
        actionId,
      },
    };
  }

  try {
    let result: ActionExecutionResult;

    switch (action.type) {
      case "RETRY_PAYMENT":
        result =
          await executeRetryPayment(
            action.id
          );
        break;

      case "CREATE_PAYMENT_LINK":
        result =
          await executeCreatePaymentLink(
            action.id
          );
        break;

      case "SEND_NOTIFICATION":
        result =
          await executeSendNotification(
            action.id
          );
        break;

      case "WAIT":
        result =
          await executeWait(
            action.id
          );
        break;

      case "ESCALATE":
        result =
          await executeEscalate(
            action.id
          );
        break;

      case "VOICE_RECOVERY":
        result =
          await executeVoiceRecovery(
            action.id
          );
        break;

      default:
        throw new Error(
          `Unsupported recovery action: ${action.type}`
        );
    }

    if (!result.success) {
      throw new Error(
        result.error ||
          "Recovery action failed"
      );
    }

    /*
     * The handler has completed successfully.
     *
     * Persist the final execution state.
     */
    const updateData = {
      status: "COMPLETED" as const,

      executedAt: new Date(),

      lockedAt: null,

      error: null,

      ...(result.result !== undefined
        ? {
            result: result.result,
          }
        : {}),

      ...(result.externalProviderId !==
      undefined
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

    /*
     * Mark the action as failed and release
     * the execution lock.
     */
    await prisma.recoveryAction.update({
      where: {
        id: action.id,
      },

      data: {
        status: "FAILED",
        error: errorMessage,
        lockedAt: null,
      },
    });

    throw error;
  }
}