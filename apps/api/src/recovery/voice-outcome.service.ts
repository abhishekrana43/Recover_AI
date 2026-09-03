import { prisma } from "@recover-ai/database";

import type {
  VoiceRecoveryResult,
} from "./voice-recovery.types.js";

export async function processVoiceRecoveryOutcome(
  recoveryCaseId: string,
  voiceCallId: string,
  outcome: VoiceRecoveryResult
): Promise<void> {
  const recoveryCase =
    await prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCaseId,
      },
      include: {
        payment: true,
      },
    });

  if (!recoveryCase) {
    throw new Error(
      `Recovery case not found: ${recoveryCaseId}`
    );
  }

  const voiceCall =
    await prisma.voiceCall.findUnique({
      where: {
        id: voiceCallId,
      },
    });

  if (!voiceCall) {
    throw new Error(
      `Voice call not found: ${voiceCallId}`
    );
  }

  /*
   * Idempotency:
   * A VoiceCall can only have one final outcome.
   */
  if (voiceCall.outcome !== null) {
    if (voiceCall.outcome === outcome.outcome) {
      return;
    }

    throw new Error(
      `Voice call already has outcome ${voiceCall.outcome}`
    );
  }

  await prisma.$transaction(async (tx) => {
    switch (outcome.outcome) {
      case "PROMISE_TO_PAY": {
        if (!outcome.promisedFor) {
          throw new Error(
            "PROMISE_TO_PAY outcome requires promisedFor"
          );
        }

        await tx.promiseToPay.create({
          data: {
            recoveryCaseId: recoveryCase.id,
            paymentId: recoveryCase.paymentId,
            amount: recoveryCase.payment.amount,
            currency: recoveryCase.payment.currency,
            promisedFor: outcome.promisedFor,
            status: "PENDING",
            source: "VOICE",
            notes:
              outcome.notes ?? outcome.summary,
          },
        });

        await tx.recoveryCase.update({
          where: {
            id: recoveryCase.id,
          },
          data: {
            status: "IN_PROGRESS",
          },
        });

        break;
      }

      case "PAYMENT_COMPLETED": {
        await tx.recoveryCase.update({
          where: {
            id: recoveryCase.id,
          },
          data: {
            status: "IN_PROGRESS",
          },
        });

        break;
      }

      case "DECLINED": {
        await tx.recoveryCase.update({
          where: {
            id: recoveryCase.id,
          },
          data: {
            status: "ESCALATED",
          },
        });

        break;
      }

      case "NO_RESPONSE":
      case "CALL_FAILED": {
        await tx.recoveryCase.update({
          where: {
            id: recoveryCase.id,
          },
          data: {
            status: "IN_PROGRESS",
          },
        });

        break;
      }
    }

    await tx.voiceCall.update({
      where: {
        id: voiceCall.id,
      },
      data: {
        outcome: outcome.outcome,
        outcomeData: outcome,
      },
    });

    await tx.auditLog.create({
      data: {
        merchantId: recoveryCase.merchantId,
        entityType: "RecoveryCase",
        entityId: recoveryCase.id,
        action: "VOICE_RECOVERY_OUTCOME",
        source: "VOICE_PROVIDER",
        metadata: {
          outcome: outcome.outcome,
          confidence: outcome.confidence,
          summary: outcome.summary,
          promisedFor:
            outcome.promisedFor?.toISOString() ??
            null,
          notes: outcome.notes ?? null,
        },
      },
    });
  });
}