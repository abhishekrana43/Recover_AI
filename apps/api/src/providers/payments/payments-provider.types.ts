import type { Prisma } from "@recover-ai/database/src/generated/client.js";

export type RetryPaymentInput = {
  recoveryCaseId: string;
  paymentId: string;
  amount: number;
  currency: string;
};

export type RetryPaymentResult = {
  success: boolean;
  provider: "RAZORPAY";
  providerPaymentId?: string;
  providerOrderId?: string;
  result?: Prisma.InputJsonValue;
  error?: string;
};

export interface PaymentProvider {
  retryPayment(
    input: RetryPaymentInput
  ): Promise<RetryPaymentResult>;
}

export type CreatePaymentLinkInput = {
  recoveryCaseId: string;
  paymentId: string;
  amount: number;
  currency: string;
};

export type CreatePaymentLinkResult = {
  success: boolean;
  provider: "RAZORPAY";
  providerPaymentLinkId?: string;
  shortUrl?: string;
  result?: Prisma.InputJsonValue;
  error?: string;
};