import "dotenv/config";
import { prisma } from "@recover-ai/database";

const recoveryCaseId = process.argv[2];

if (!recoveryCaseId) {
  throw new Error(
    "Usage: npx tsx src/execution/create-wait-test-action.ts <recoveryCaseId>"
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

const action =
  await prisma.recoveryAction.create({
    data: {
      recoveryCaseId,
      type: "WAIT",
      status: "COMPLETED",

      scheduledFor: new Date(
        Date.now() - 1000
      ),

      payload: {
        delayMinutes: 1,
      },

      result: {
        action: "WAIT",
        scheduledFor: new Date(
          Date.now() - 1000
        ).toISOString(),
      },
    },
  });

console.log(
  "Created WAIT scheduler test action:"
);

console.log(action);

await prisma.$disconnect();