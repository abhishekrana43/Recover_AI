import { prisma } from "@recover-ai/database";

import type { RecoveryContext } from "./recovery-agent.types.js";

export async function buildRecoveryContext(
  recoveryCaseId: string
): Promise<RecoveryContext> {
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: {
      id: recoveryCaseId,
    },
    include: {
      payment: {
        include: {
          attempts: {
            orderBy: {
              attemptNumber: "asc",
            },
          },
        },
      },
    },
  });

  if (!recoveryCase) {
    throw new Error(
      `Recovery case not found: ${recoveryCaseId}`
    );
  }

  return {
    recoveryCaseId: recoveryCase.id,
    paymentId: recoveryCase.paymentId,

    payment: {
      status: recoveryCase.payment.status,
      amount: recoveryCase.payment.amount,
      currency: recoveryCase.payment.currency,
      failureReason: recoveryCase.payment.failureReason,
    },

    recoveryCase: {
      status: recoveryCase.status,
      amountAtRisk: recoveryCase.amountAtRisk,
      amountRecovered: recoveryCase.amountRecovered,
      failureReason: recoveryCase.failureReason,
    },

    attempts: recoveryCase.payment.attempts.map(
      (attempt) => ({
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        failureReason: attempt.failureReason,
        attemptedAt: attempt.attemptedAt.toISOString(),
      })
    ),

    availableActions: [
      "RETRY_PAYMENT",
      "CREATE_PAYMENT_LINK",
      "SEND_NOTIFICATION",
      "WAIT",
      "ESCALATE",
    ],
  };
}