import { handlePaymentCaptured } from "../../events/handlers/payment-captured.handler.js";

const razorpayOrderId = process.argv[2];

if (!razorpayOrderId) {
  throw new Error(
    "Usage: npx tsx src/events/payment-captured.test-runner.ts <razorpayOrderId>"
  );
}

await handlePaymentCaptured({
  payload: {
    payment: {
      entity: {
        id: `pay_test_${Date.now()}`,
        order_id: razorpayOrderId,
        amount: 49900,
        currency: "INR",
      },
    },
  },
});

console.log("payment.captured processed successfully");