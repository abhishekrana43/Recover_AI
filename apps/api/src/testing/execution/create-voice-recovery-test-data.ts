import "dotenv/config";

import { prisma } from "@recover-ai/database";

async function main() {
  const merchant =
    await prisma.merchant.findFirst();

  if (!merchant) {
    throw new Error(
      "No merchant found. Create a merchant first."
    );
  }

  const customer =
    await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        name: `Voice Recovery Auto Test ${Date.now()}`,
        email:
          `voice-auto-test-${Date.now()}@example.com`,
        phone: "+919027772881",
      },
    });

  const payment =
    await prisma.payment.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,
        razorpayPaymentId:
          `pay_voice_auto_test_${Date.now()}`,
        amount: 49900,
        currency: "INR",
        status: "FAILED",
        failureReason:
          "Automatic voice recovery test",
      },
    });

  console.log(
    "\n=== AUTOMATIC VOICE RECOVERY TEST DATA ===\n"
  );

  console.dir(
    {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      paymentId: payment.id,
      razorpayPaymentId:
        payment.razorpayPaymentId,
    },
    { depth: null }
  );

  console.log(
    "\nUse this Razorpay payment ID for the payment.failed test:"
  );

  console.log(
    payment.razorpayPaymentId
  );
}

main()
  .catch((error) => {
    console.error(
      "Failed to create automatic voice recovery test data:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });