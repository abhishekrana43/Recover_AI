import { prisma } from "@recover-ai/database";

import {
  getVoiceProvider,
} from "../providers/voice/voice-provider.factory.js";

export async function initiateVoiceRecovery(
  recoveryCaseId: string
) {
  const recoveryCase =
    await prisma.recoveryCase.findUnique({
      where: {
        id: recoveryCaseId,
      },
      include: {
        payment: true,
        merchant: true,
      },
    });

  if (!recoveryCase) {
    throw new Error(
      `Recovery case not found: ${recoveryCaseId}`
    );
  }

  if (
    !["OPEN", "IN_PROGRESS"].includes(
      recoveryCase.status
    )
  ) {
    throw new Error(
      `Recovery case is not active: ${recoveryCase.status}`
    );
  }

  const customer = recoveryCase.payment.customerId
    ? await prisma.customer.findUnique({
        where: {
          id: recoveryCase.payment.customerId,
        },
      })
    : null;

  if (!customer) {
    throw new Error(
      `Customer not found for recovery case: ${recoveryCaseId}`
    );
  }

  if (!customer.phone) {
    throw new Error(
      `Customer does not have a phone number: ${customer.id}`
    );
  }

 const voiceProvider =
 getVoiceProvider();

  const result =
      await voiceProvider.initiateCall({
      recoveryCaseId: recoveryCase.id,
      customerName: customer.name,
      phoneNumber: customer.phone,
      amount: recoveryCase.payment.amount,
      currency: recoveryCase.payment.currency,
    });

  if (!result.success) {
    throw new Error(
      result.error ||
        "Failed to initiate voice recovery call"
    );
  }



  if (!result.providerCallId) {
       throw new Error(
       "Voice provider returned no provider call ID"
      );
  }

const voiceCall = await prisma.voiceCall.create({
  data: {
    recoveryCaseId: recoveryCase.id,
    provider: result.provider,
    providerCallId: result.providerCallId,
    status: result.status ?? "QUEUED",
    phoneNumber: customer.phone,
  },
});

  await prisma.recoveryCase.update({
    where: {
      id: recoveryCase.id,
    },
    data: {
      status: "IN_PROGRESS",
    },
  });

  await prisma.auditLog.create({
    data: {
      merchantId: recoveryCase.merchantId,
      entityType: "RecoveryCase",
      entityId: recoveryCase.id,
      action: "VOICE_RECOVERY_INITIATED",
      source: "VOICE_PROVIDER",
      metadata: {
        provider: result.provider,
        providerCallId:
          result.providerCallId ?? null,
        customerId: customer.id,
      },
    },
  });

  return {
  success: true,
  recoveryCaseId: recoveryCase.id,
  voiceCallId: voiceCall.id,
  provider: result.provider,
  providerCallId: result.providerCallId,
  status: result.status,
  };
}