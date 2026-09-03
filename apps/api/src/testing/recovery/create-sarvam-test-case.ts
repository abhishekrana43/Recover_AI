import "dotenv/config";

import { prisma } from "@recover-ai/database";

async function main() {
  const merchant = await prisma.merchant.findFirst();

  if (!merchant) {
    throw new Error(
      "No merchant found. Create a merchant first."
    );
  }

  const phoneNumber =
    "+919027772881";

  const customer =
    await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        name: `Sarvam Demo ${Date.now()}`,
        email:
          `sarvam-demo-${Date.now()}@example.com`,
        phone: phoneNumber,
      },
    });

  const payment =
    await prisma.payment.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,

        razorpayPaymentId:
          `pay_sarvam_test_${Date.now()}`,

        amount: 49900,
        currency: "INR",

        status: "FAILED",

        failureReason:
          "Payment failed during recovery test",
      },
    });

  const paymentAttempt =
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,

        attemptNumber: 1,

        status: "FAILED",

        failureReason:
          "Payment failed during recovery test",

        razorpayOrderId:
          `order_sarvam_test_${Date.now()}`,
      },
    });

  const recoveryCase =
    await prisma.recoveryCase.create({
      data: {
        merchantId: merchant.id,
        paymentId: payment.id,

        status: "IN_PROGRESS",

        amountAtRisk:
          payment.amount,

        amountRecovered: 0,

        failureReason:
          payment.failureReason,
      },
    });

  console.log("\n=== SARVAM TEST CASE CREATED ===");

  console.log({
    merchantId:
      merchant.id,

    customerId:
      customer.id,

    customerPhone:
      customer.phone,

    paymentId:
      payment.id,

    paymentAttemptId:
      paymentAttempt.id,

    recoveryCaseId:
      recoveryCase.id,
  });

  console.log(
    "\nUse this recoveryCaseId:"
  );

  console.log(
    recoveryCase.id
  );
}

main()
  .catch((error) => {
    console.error(
      "Failed to create Sarvam test case:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });