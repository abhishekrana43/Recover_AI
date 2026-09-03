import {
  processRecoveryActions,
} from "./recovery-action.worker.js";

const ACTION_INTERVAL_MS = 5_000;

let running = false;

export function startRecoveryActionScheduler() {
  console.log(
    `Recovery action scheduler started. Interval: ${ACTION_INTERVAL_MS}ms`
  );

  const run = async () => {
    if (running) {
      return;
    }

    running = true;

    try {
      await processRecoveryActions();
    } catch (error) {
      console.error(
        "Recovery action scheduler failed:",
        error
      );
    } finally {
      running = false;
    }
  };

  void run();

  return setInterval(() => {
    void run();
  }, ACTION_INTERVAL_MS);
}