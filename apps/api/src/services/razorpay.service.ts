import { getRazorpayClient } from "../config/razorpay.js";

export async function getPayment(paymentId: string) {
  return getRazorpayClient().payments.fetch(paymentId);
}
