import { processWebhookRetries } from "./webhook-retry.worker.js";

const RETRY_INTERVAL_MS = 10_000;

let running = false;

export function startWebhookRetryScheduler() {
  console.log(
    `Webhook retry scheduler started. Interval: ${RETRY_INTERVAL_MS}ms`
  );

  const run = async () => {
    if (running) {
      return;
    }

    running = true;

    try {
      await processWebhookRetries();
    } catch (error) {
      console.error(
        "Webhook retry scheduler failed:",
        error
      );
    } finally {
      running = false;
    }
  };

  void run();

  return setInterval(() => {
    void run();
  }, RETRY_INTERVAL_MS);
}