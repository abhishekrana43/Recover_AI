
import { WEBHOOK_EVENTS } from "./event.types.js";
import { handlePaymentFailed } from "./handlers/payment-failed.handler.js";

export async function dispatchWebhookEvent(
  eventType: string,
  payload: unknown
): Promise<void> {
  switch (eventType) {
    case WEBHOOK_EVENTS.PAYMENT_FAILED:
      await handlePaymentFailed(payload);
      return;

    case WEBHOOK_EVENTS.PAYMENT_CAPTURED:
      console.log("payment.captured handler not implemented yet");
      return;

    default:
      console.log(`Ignoring unsupported webhook event: ${eventType}`);
      return;
  }
}