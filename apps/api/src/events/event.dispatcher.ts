import { WEBHOOK_EVENTS } from "./event.types.js";
import { handlePaymentFailed } from "./handlers/payment-failed.handler.js";
import { handlePaymentCaptured } from "./handlers/payment-captured.handler.js";

export async function dispatchWebhookEvent(
  eventType: string,
  payload: unknown
): Promise<void> {
  switch (eventType) {
    case WEBHOOK_EVENTS.PAYMENT_FAILED:
      await handlePaymentFailed(payload);
      return;

    case WEBHOOK_EVENTS.PAYMENT_CAPTURED:
      await handlePaymentCaptured(payload);
      return;
   
  
    default:
      console.log(
        `Ignoring unsupported webhook event: ${eventType}`
      );
      return;
  }
}