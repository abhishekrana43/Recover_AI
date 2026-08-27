import { prisma } from "@recover-ai/database";

import type {
  ActionExecutionResult,
} from "../action-executor.types.js";

export async function executeEscalate(
  actionId: string
): Promise<ActionExecutionResult> {
  console.log(
    `Executing ESCALATE action: ${actionId}`
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

  const recoveryCase = action.recoveryCase;

  /*
   * An already recovered case should never be
   * escalated.
   */
  if (recoveryCase.status === "RECOVERED") {
    throw new Error(
      "Cannot escalate a recovered recovery case"
    );
  }

  /*
   * Read escalation configuration from action payload.
   *
   * Example:
   *
   * {
   *   "reason": "Multiple payment recovery attempts failed",
   *   "priority": "HIGH"
   * }
   */

  const payload =
    action.payload &&
    typeof action.payload === "object" &&
    !Array.isArray(action.payload)
      ? action.payload as {
          reason?: unknown;
          priority?: unknown;
        }
      : {};

  const reason =
    typeof payload.reason === "string" &&
    payload.reason.trim().length > 0
      ? payload.reason
      : "Recovery action requires human intervention";

  const priority =
    payload.priority === "LOW" ||
    payload.priority === "MEDIUM" ||
    payload.priority === "HIGH"
      ? payload.priority
      : "HIGH";

  /*
   * Move the recovery case into the ESCALATED state.
   */
  await prisma.recoveryCase.update({
    where: {
      id: recoveryCase.id,
    },
    data: {
      status: "ESCALATED",
      closureReason: reason,
    },
  });

  return {
    success: true,
    action: "ESCALATE",
    result: {
      recoveryCaseId: recoveryCase.id,
      status: "ESCALATED",
      reason,
      priority,
      escalatedAt: new Date().toISOString(),
    },
  };
}