import "dotenv/config";

import { prisma } from "@recover-ai/database";

import { dispatchWebhookEvent } from "../../events/event.dispatcher.js";

async function main() {
  const razorpayPaymentId = process.argv[2];

  if (!razorpayPaymentId) {
    throw new Error(
      "Usage: npx tsx src/testing/webhook/automatic-voice-recovery.test-runner.ts <razorpayPaymentId>"
    );
  }

  const payment =
    await prisma.payment.findUnique({
      where: {
        razorpayPaymentId,
      },
      include: {
        customer: true,
      },
    });

  if (!payment) {
    throw new Error(
      `Payment not found: ${razorpayPaymentId}`
    );
  }

  if (!payment.customer?.phone) {
    throw new Error(
      `Customer has no phone number: ${payment.customerId}`
    );
  }

  const payload = {
    entity: "event",

    event: "payment.failed",

    payload: {
      payment: {
        entity: {
          id: payment.razorpayPaymentId,
          amount: payment.amount,
          error_description:
            "Automatic voice recovery test",
        },
      },
    },
  };

  console.log(
    "\n=== DISPATCHING PAYMENT_FAILED ===\n"
  );

  console.dir(
    {
      paymentId: payment.id,
      razorpayPaymentId:
        payment.razorpayPaymentId,
      customerId: payment.customerId,
      customerName:
        payment.customer?.name,
      customerPhone:
        payment.customer?.phone,
    },
    { depth: null }
  );

  await dispatchWebhookEvent(
    "payment.failed",
    payload
  );

  console.log(
    "\n=== PAYMENT_FAILED DISPATCHED ===\n"
  );

  const recoveryCase =
    await prisma.recoveryCase.findFirst({
      where: {
        paymentId: payment.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        actions: true,
      },
    });

  if (!recoveryCase) {
    throw new Error(
      "RecoveryCase was not created"
    );
  }

  console.log(
    "\n=== RECOVERY CASE CREATED ===\n"
  );

  console.dir(
    {
      recoveryCaseId:
        recoveryCase.id,

      status:
        recoveryCase.status,

      actions:
        recoveryCase.actions.map(
          (action) => ({
            id: action.id,
            type: action.type,
            status: action.status,
          })
        ),
    },
    { depth: null }
  );
}

main()
  .catch((error) => {
    console.error(
      "\nAutomatic voice recovery test failed:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });