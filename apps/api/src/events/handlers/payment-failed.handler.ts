import { prisma } from "@recover-ai/database";

type PaymentFailedPayload = {
  payload?: {
    payment?: {
      entity?: {
        id?: unknown;
        amount?: unknown;
        error_description?: unknown;
      };
    };
  };
};

function getRazorpayPaymentId(payload: unknown): string {
  const data = payload as PaymentFailedPayload;
  const paymentId = data.payload?.payment?.entity?.id;

  if (typeof paymentId !== "string" || !paymentId) {
    throw new Error("Missing Razorpay payment ID in payment.failed payload");
  }

  return paymentId;
}

export async function handlePaymentFailed(
  payload: unknown
): Promise<void> {
  const razorpayPaymentId = getRazorpayPaymentId(payload);

  const data = payload as PaymentFailedPayload;
  const entity = data.payload?.payment?.entity;

  const failureReason =
    typeof entity?.error_description === "string"
      ? entity.error_description
      : "Payment failed";

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: {
        razorpayPaymentId,
      },
    });

    if (!payment) {
      throw new Error(
        `Payment not found for Razorpay payment ID: ${razorpayPaymentId}`
      );
    }

    const previousStatus = payment.status;

    await tx.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: "FAILED",
        failureReason,
      },
    });

    const latestAttempt = await tx.paymentAttempt.findFirst({
      where: {
        paymentId: payment.id,
      },
      orderBy: {
        attemptNumber: "desc",
      },
      select: {
        attemptNumber: true,
      },
    });

    const attemptNumber = (latestAttempt?.attemptNumber ?? 0) + 1;

    await tx.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber,
        status: "FAILED",
        failureReason,
      },
    });

    const existingRecoveryCase = await tx.recoveryCase.findFirst({
      where: {
        paymentId: payment.id,
        status: {
          in: ["OPEN", "IN_PROGRESS", "ESCALATED"],
        },
      },
    });

    if (!existingRecoveryCase) {
      await tx.recoveryCase.create({
        data: {
          merchantId: payment.merchantId,
          paymentId: payment.id,
          status: "OPEN",
          amountAtRisk: payment.amount,
          failureReason,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        merchantId: payment.merchantId,
        entityType: "Payment",
        entityId: payment.id,
        action: "PAYMENT_FAILED",
        source: "RAZORPAY_WEBHOOK",
        previousState: {
          status: previousStatus,
        },
        newState: {
          status: "FAILED",
          failureReason,
        },
        metadata: {
          razorpayPaymentId,
          attemptNumber,
        },
      },
    });
  });
}