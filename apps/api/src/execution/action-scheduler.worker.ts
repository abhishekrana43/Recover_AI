import "dotenv/config";

import { processScheduledActions } from "./action-scheduler.service.js";
import { prisma } from "@recover-ai/database";

try {
  await processScheduledActions();

  console.log(
    "Action scheduler worker completed."
  );
} catch (error) {
  console.error(
    "Action scheduler worker failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}