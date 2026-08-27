import "dotenv/config";
import crypto from "crypto";

const eventId = "evt_test_1787578464253";

// Replace this with the actual Attempt #2 razorpayOrderId
const razorpayOrderId = "order_TU4oLWhuJuWHbv";

const payload = {
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "pay_test_1787578464253",
        order_id: razorpayOrderId,
        amount: 49900,
        currency: "INR",
      },
    },
  },
};

const rawBody = JSON.stringify(payload);

const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

if (!secret) {
  throw new Error(
    "RAZORPAY_WEBHOOK_SECRET is not defined"
  );
}

const signature = crypto
  .createHmac("sha256", secret)
  .update(rawBody)
  .digest("hex");

console.log("Event ID:", eventId);
console.log("Signature:", signature);
console.log("Payload:", rawBody);

const response = await fetch(
  "http://localhost:4000/api/webhooks/razorpay",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-event-id": eventId,
      "x-razorpay-signature": signature,
    },
    body: rawBody,
  }
);

console.log("HTTP Status:", response.status);

const responseBody = await response.text();

console.log("Response:");
console.log(responseBody);