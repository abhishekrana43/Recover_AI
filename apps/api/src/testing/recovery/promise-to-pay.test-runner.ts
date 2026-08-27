import "dotenv/config";

import { prisma } from "@recover-ai/database";
import { createPromiseToPay } from "../../recovery/promise-to-pay.service.js";

const recoveryCaseId = process.argv[2];

if (!recoveryCaseId) {
  throw new Error(
    "Usage: npx tsx src/recovery/promise-to-pay.test-runner.ts <recoveryCaseId>"
  );
}

const recoveryCase =
  await prisma.recoveryCase.findUnique({
    where: {
      id: recoveryCaseId,
    },
  });

if (!recoveryCase) {
  throw new Error(
    `Recovery case not found: ${recoveryCaseId}`
  );
}

const promisedFor = new Date(
  Date.now() + 60 * 60 * 1000
);

const promise = await createPromiseToPay({
  recoveryCaseId,
  promisedFor,
  source: "MANUAL",
  notes: "Customer promised payment within one hour",
});

console.log("\nPromise-to-Pay created:");
console.log(promise);

await prisma.$disconnect();