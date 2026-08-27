import { prisma } from "@recover-ai/database";

import type {
  ActionExecutionResult,
} from "../action-executor.types.js";

export async function executeWait(
  actionId: string
): Promise<ActionExecutionResult> {
  console.log(
    `Executing WAIT action: ${actionId}`
  );

  const action =
    await prisma.recoveryAction.findUnique({
      where: {
        id: actionId,
      },
      include: {
        recoveryCase: true,
      },
    });

  if (!action) {
    throw new Error(
      `Recovery action not found: ${actionId}`
    );
  }

  if (
    action.recoveryCase.status !== "OPEN" &&
    action.recoveryCase.status !== "IN_PROGRESS"
  ) {
    throw new Error(
      `Cannot wait on inactive recovery case: ${action.recoveryCase.status}`
    );
  }

  /*
   * WAIT duration is supplied through the action payload.
   *
   * Example:
   *
   * {
   *   "delayMinutes": 60
   * }
   */

  const payload =
    action.payload &&
    typeof action.payload === "object" &&
    !Array.isArray(action.payload)
      ? action.payload as {
          delayMinutes?: unknown;
        }
      : {};

  const delayMinutes =
    typeof payload.delayMinutes === "number" &&
    Number.isFinite(payload.delayMinutes) &&
    payload.delayMinutes > 0
      ? payload.delayMinutes
      : 60;

  const scheduledFor = new Date(
    Date.now() +
      delayMinutes * 60 * 1000
  );

  /*
   * WAIT is not an external API call.
   *
   * We schedule the action and leave it COMPLETED.
   * A future scheduler can pick up the scheduled workflow.
   */
  await prisma.recoveryAction.update({
    where: {
      id: action.id,
    },
    data: {
      scheduledFor,
      result: {
        action: "WAIT",
        delayMinutes,
        scheduledFor:
          scheduledFor.toISOString(),
      },
    },
  });

  return {
    success: true,
    action: "WAIT",
    result: {
      action: "WAIT",
      delayMinutes,
      scheduledFor:
        scheduledFor.toISOString(),
    },
  };
}