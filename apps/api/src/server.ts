import "dotenv/config";
import app from "./app.js";
import { startWebhookRetryScheduler } from "./workers/webhook-retry.scheduler.js";
import {
  startRecoveryActionScheduler,
} from "./workers/recovery-action.scheduler.js";


const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);

  startWebhookRetryScheduler();
  startRecoveryActionScheduler();
});
