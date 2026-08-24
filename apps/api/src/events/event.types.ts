export const WEBHOOK_EVENTS = {
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_CAPTURED: "payment.captured",
} as const;

export type SupportedWebhookEvent =
  (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];