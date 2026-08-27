import { prisma } from "@recover-ai/database";

import { evaluateRecoveryPolicy } from "../policy/policy.engine.js";
import type { RecoveryActionType } from "../policy/policy.types.js";

export async function createRecoveryAction(
  recoveryCaseId: string,
  requestedAction: RecoveryActionType
) {
  return prisma.$transaction(
    async (tx) => {
    const recoveryCase = await tx.recoveryCase.findUnique({
      where: {
        id: recoveryCaseId,
      },
      include: {
        payment: {
          include: {
            attempts: true,
          },
        },
      },
    });

    if (!recoveryCase) {
      throw new Error(
        `Recovery case not found: ${recoveryCaseId}`
      );
    }

    const policyResult = evaluateRecoveryPolicy({
      recoveryCaseId: recoveryCase.id,
      paymentId: recoveryCase.paymentId,
      paymentStatus: recoveryCase.payment.status,
      recoveryStatus: recoveryCase.status,
      amount: recoveryCase.payment.amount,
      attemptCount: recoveryCase.payment.attempts.length,
      requestedAction,
    });

    const actionStatus =
      policyResult.decision === "ALLOW"
        ? "APPROVED"
        : "REJECTED";

    const action = await tx.recoveryAction.create({
      data: {
        recoveryCaseId: recoveryCase.id,
        type: requestedAction,
        status: actionStatus,
      },
    });

    const policyDecision = await tx.policyDecision.create({
      data: {
        recoveryActionId: action.id,
        decision: policyResult.decision,
        reason: policyResult.message,
      },
    });

    await tx.auditLog.create({
      data: {
        merchantId: recoveryCase.merchantId,
        entityType: "RecoveryAction",
        entityId: action.id,
        action: "POLICY_EVALUATED",
        source: "RECOVERY_POLICY_ENGINE",
        metadata: {
          requestedAction,
          decision: policyResult.decision,
          reason: policyResult.reason,
          approvalRequired: policyResult.approvalRequired,
        },
      },
    });

    return {
      action,
      policyDecision,
      policyResult,
    };
  },
  {
      maxWait: 10_000,
      timeout: 20_000,
    }
);
}