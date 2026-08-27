import Razorpay from "razorpay";

import type {
  PaymentProvider,
  RetryPaymentInput,
  RetryPaymentResult,
} from "./payments-provider.types.js";

import type {
  CreatePaymentLinkInput,
  CreatePaymentLinkResult,
} from "./payments-provider.types.js";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error(
    "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required"
  );
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export class RazorpayPaymentProvider
  implements PaymentProvider
{
  async retryPayment(
    input: RetryPaymentInput
  ): Promise<RetryPaymentResult> {
    /*
     * IMPORTANT:
     *
     * The original Razorpay payment has already failed.
     * We should not mutate the historical payment record.
     *
     * The actual retry flow will create a new payment attempt/order
     * through the appropriate Razorpay API flow.
     */

    const order = await razorpay.orders.create({
      amount: input.amount,
      currency: input.currency,
      receipt: `recovery_${input.recoveryCaseId}`,
      notes: {
        recoveryCaseId: input.recoveryCaseId,
        originalPaymentId: input.paymentId,
      },
    });

    return {
      success: true,
      provider: "RAZORPAY",
      providerOrderId: order.id,
      result: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      },
    };
  }
  
  async createPaymentLink(
  input: CreatePaymentLinkInput
): Promise<CreatePaymentLinkResult> {
  const paymentLink = await razorpay.paymentLink.create({
    amount: input.amount,
    currency: input.currency,

    description: "Payment recovery",

    reference_id:
      `recovery_${input.recoveryCaseId}`,

    customer: {
      name: "Recovery Customer",
    },

    notify: {
      sms: false,
      email: false,
      whatsapp: false,
    },

    reminder_enable: true,

    notes: {
      recoveryCaseId: input.recoveryCaseId,
      originalPaymentId: input.paymentId,
    },
  });

  return {
    success: true,
    provider: "RAZORPAY",
    providerPaymentLinkId: paymentLink.id,
    shortUrl: paymentLink.short_url,

    result: {
      paymentLinkId: paymentLink.id,
      shortUrl: paymentLink.short_url,
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      status: paymentLink.status,
    },
  };
}
}

export const razorpayPaymentProvider =
  new RazorpayPaymentProvider();