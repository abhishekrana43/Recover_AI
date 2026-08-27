import { retryFailedWebhooks } from "./webhook-retry.service.js";

const INTERVAL_MS = 10_000; // every 10 seconds

let running = false;

async function run() {
  if (running) {
    console.log("Webhook retry worker already running, skipping tick.");
    return;
  }

  running = true;

  try {
    await retryFailedWebhooks();
  } catch (error) {
    console.error(
      "Webhook retry scheduler error:",
      error
    );
  } finally {
    running = false;
  }
}

console.log(
  `Webhook retry scheduler started. Interval: ${INTERVAL_MS}ms`
);

// Run immediately when the process starts
await run();

// Then continue periodically
setInterval(run, INTERVAL_MS);