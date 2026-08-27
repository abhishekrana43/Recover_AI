import type { RecoveryActionType } from "../policy/policy.types.js";
import { prisma } from "@recover-ai/database";
import { evaluateRecoveryPolicy } from "../policy/policy.engine.js";

export async function evaluateRecoveryCasePolicy(
  recoveryCaseId: string,
  requestedAction: RecoveryActionType
) {
  const recoveryCase = await prisma.recoveryCase.findUnique({
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

  const result = evaluateRecoveryPolicy({
    recoveryCaseId: recoveryCase.id,
    paymentId: recoveryCase.paymentId,
    paymentStatus: recoveryCase.payment.status,
    recoveryStatus: recoveryCase.status,
    amount: recoveryCase.payment.amount,
    attemptCount: recoveryCase.payment.attempts.length,
    requestedAction,
  });

  return {
    recoveryCase,
    result,
  };
}