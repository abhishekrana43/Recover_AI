import { prisma } from "@recover-ai/database";
import {
  fulfillPromiseToPay,
} from "../../recovery/promise-to-pay.service.js";


type PaymentCapturedPayload = {
  payload?: {
    payment?: {
      entity?: {
        id?: unknown;
        order_id?: unknown;
        amount?: unknown;
        currency?: unknown;
      };
    };
  };
};

function getPaymentEntity(payload: unknown) {
  const data = payload as PaymentCapturedPayload;
  const entity = data.payload?.payment?.entity;

  if (!entity) {
    throw new Error(
      "Missing payment entity in payment.captured payload"
    );
  }

  return entity;
}

function getRazorpayPaymentId(payload: unknown): string {
  const entity = getPaymentEntity(payload);

  if (
    typeof entity.id !== "string" ||
    !entity.id
  ) {
    throw new Error(
      "Missing Razorpay payment ID in payment.captured payload"
    );
  }

  return entity.id;
}

export async function handlePaymentCaptured(
  payload: unknown
): Promise<void> {
  const entity = getPaymentEntity(payload);

  const razorpayPaymentId =
    getRazorpayPaymentId(payload);

  const razorpayOrderId =
    typeof entity.order_id === "string"
      ? entity.order_id
      : undefined;

  const amount =
    typeof entity.amount === "number"
      ? entity.amount
      : undefined;

  if (!razorpayOrderId) {
    throw new Error(
      "Razorpay order ID is missing from payment.captured webhook"
    );
  }

await prisma.$transaction(async (tx) => {
  const attempt =
    await tx.paymentAttempt.findFirst({
      where: {
        razorpayOrderId,
      },
      include: {
        payment: true,
      },
    });

  if (!attempt) {
    throw new Error(
      `Payment attempt not found for Razorpay order ${razorpayOrderId}`
    );
  }

  const payment = attempt.payment;
  const previousStatus = payment.status;

  /*
   * Idempotency
   */
  if (attempt.status === "CAPTURED") {
    return;
  }

  /*
   * PaymentAttempt → CAPTURED
   */
  await tx.paymentAttempt.update({
    where: {
      id: attempt.id,
    },
    data: {
      status: "CAPTURED",
      razorpayPaymentId,
    },
  });

  /*
   * Payment → CAPTURED
   */
  await tx.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      status: "CAPTURED",
      failureReason: null,
    },
  });

  /*
   * PromiseToPay → FULFILLED
   */
  await fulfillPromiseToPay(
    payment.id,
    tx
  );

  /*
   * Find active recovery case
   */
  const recoveryCase =
    await tx.recoveryCase.findFirst({
      where: {
        paymentId: payment.id,
        status: {
          in: [
            "OPEN",
            "IN_PROGRESS",
            "ESCALATED",
          ],
        },
      },
    });

  /*
   * RecoveryCase → RECOVERED
   */
  if (recoveryCase) {
    await tx.recoveryCase.update({
      where: {
        id: recoveryCase.id,
      },
      data: {
        status: "RECOVERED",
        amountRecovered: payment.amount,
        resolvedAt: new Date(),
        closureReason: "PAYMENT_RECOVERED",
      },
    });
  }

  /*
   * Audit log
   */
  await tx.auditLog.create({
    data: {
      merchantId: payment.merchantId,
      entityType: "Payment",
      entityId: payment.id,
      action: "PAYMENT_CAPTURED",
      source: "RAZORPAY_WEBHOOK",

      previousState: {
        status: previousStatus,
      },

      newState: {
        status: "CAPTURED",
      },

      metadata: {
        razorpayPaymentId,
        razorpayOrderId,
        amount: amount ?? null,
        recoveryCaseId:
          recoveryCase?.id ?? null,
      },
    },
  });
});
}
