import { prisma } from "@recover-ai/database";

export type CreatePromiseToPayInput = {
  recoveryCaseId: string;
  promisedFor: Date;
  source:
    | "VOICE"
    | "SMS"
    | "WHATSAPP"
    | "EMAIL"
    | "MANUAL";
  notes?: string;
};

export async function createPromiseToPay(
  input: CreatePromiseToPayInput
) {
  if (input.promisedFor <= new Date()) {
    throw new Error(
      "Promise-to-pay date must be in the future"
    );
  }

  return prisma.$transaction(async (tx) => {
    const recoveryCase =
      await tx.recoveryCase.findUnique({
        where: {
          id: input.recoveryCaseId,
        },
        include: {
          payment: true,
        },
      });

    if (!recoveryCase) {
      throw new Error(
        `Recovery case not found: ${input.recoveryCaseId}`
      );
    }

    if (
      recoveryCase.status !== "OPEN" &&
      recoveryCase.status !== "IN_PROGRESS"
    ) {
      throw new Error(
        `Cannot create promise for inactive recovery case: ${recoveryCase.status}`
      );
    }

    if (recoveryCase.payment.status === "CAPTURED") {
      throw new Error(
        "Cannot create promise for captured payment"
      );
    }

    /*
     * Only one active promise should exist
     * for a recovery case.
     */
    const existing =
      await tx.promiseToPay.findFirst({
        where: {
          recoveryCaseId:
            input.recoveryCaseId,
          status: "PENDING",
        },
      });

    if (existing) {
      throw new Error(
        `Active promise-to-pay already exists: ${existing.id}`
      );
    }

    return tx.promiseToPay.create({
      data: {
        recoveryCaseId:
          recoveryCase.id,

        paymentId:
          recoveryCase.payment.id,

        amount:
          recoveryCase.payment.amount,

        currency:
          recoveryCase.payment.currency,

        promisedFor:
          input.promisedFor,

        source:
          input.source,

        ...(input.notes
          ? {
              notes: input.notes,
            }
          : {}),
      },
    });
  });
}

export async function fulfillPromiseToPay(
  paymentId: string
) {
  return prisma.$transaction(async (tx) => {
    const promise =
      await tx.promiseToPay.findFirst({
        where: {
          paymentId,
          status: "PENDING",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!promise) {
      return null;
    }

    return tx.promiseToPay.update({
      where: {
        id: promise.id,
      },
      data: {
        status: "FULFILLED",
        fulfilledAt: new Date(),
      },
    });
  });
}