import { prisma } from "../src/client.js";

async function main() {
  const merchant = await prisma.merchant.create({
    data: {
      name: "Recover-AI Demo Merchant",
      razorpayAccountId: "demo_razorpay_account",
    },
  });

  const customer = await prisma.customer.create({
    data: {
      merchantId: merchant.id,
      name: "Demo Customer",
      email: "customer@example.com",
      phone: "+919999999999",
    },
  });

  const payment = await prisma.payment.create({
    data: {
      merchantId: merchant.id,
      customerId: customer.id,
      razorpayPaymentId: "pay_demo_recover_ai_001",
      amount: 49900,
      currency: "INR",
      status: "CREATED",
    },
  });

  console.log("Seed completed:");
  console.log({
    merchantId: merchant.id,
    customerId: customer.id,
    paymentId: payment.id,
    razorpayPaymentId: payment.razorpayPaymentId,
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });