import "dotenv/config";
import "./webhook-retry.scheduler.js";

import { prisma } from "@recover-ai/database";
import { retryFailedWebhooks } from "./webhook-retry.service.js";

await retryFailedWebhooks();

console.log("Webhook retry worker completed.");

await prisma.$disconnect();