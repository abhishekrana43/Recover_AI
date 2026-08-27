import "dotenv/config";
import { prisma } from "@recover-ai/database";

const merchant = await prisma.merchant.findFirst();

if (!merchant) {
  throw new Error("No merchant found in database.");
}

const customer = await prisma.customer.findFirst({
  where: {
    merchantId: merchant.id,
  },
});

if (!customer) {
  throw new Error(
    `No customer found for merchant ${merchant.id}.`
  );
}

const payment = await prisma.payment.create({
  data: {
    merchantId: merchant.id,
    customerId: customer.id,
    razorpayPaymentId: `pay_test_${Date.now()}`,
    amount: 49900,
    currency: "INR",
    status: "FAILED",
    failureReason: "Payment failed for testing payment link recovery",
  },
});

const recoveryCase = await prisma.recoveryCase.create({
  data: {
    merchantId: merchant.id,
    paymentId: payment.id,
    status: "OPEN",
    amountAtRisk: payment.amount,
    amountRecovered: 0,
    failureReason: payment.failureReason,
  },
});

const action = await prisma.recoveryAction.create({
  data: {
    recoveryCaseId: recoveryCase.id,
    type: "CREATE_PAYMENT_LINK",
    status: "APPROVED",
    approvalRequired: false,
    approvedAt: new Date(),
    approvalReason: "Test CREATE_PAYMENT_LINK execution",
    payload: {
      source: "create-payment-link-test",
    },
  },
});

console.log("\nPayment:");
console.log(payment);

console.log("\nRecovery case:");
console.log(recoveryCase);

console.log("\nCREATE_PAYMENT_LINK action:");
console.log(action);

await prisma.$disconnect();