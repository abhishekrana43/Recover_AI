import "dotenv/config";

import { prisma } from "@recover-ai/database";

const recoveryCaseId = process.argv[2];

if (!recoveryCaseId) {
  throw new Error(
    "Usage: npx tsx src/execution/create-payment-link-action.test-runner.ts <recoveryCaseId>"
  );
}

const recoveryCase =
  await prisma.recoveryCase.findUnique({
    where: {
      id: recoveryCaseId,
    },
    include: {
      payment: true,
    },
  });

if (!recoveryCase) {
  throw new Error(
    `Recovery case not found: ${recoveryCaseId}`
  );
}

if (
  recoveryCase.status !== "OPEN" &&
  recoveryCase.status !== "IN_PROGRESS"
) {
  throw new Error(
    `Recovery case is not active: ${recoveryCase.status}`
  );
}

if (recoveryCase.payment.status === "CAPTURED") {
  throw new Error(
    "Payment is already captured"
  );
}

const action =
  await prisma.recoveryAction.create({
    data: {
      recoveryCaseId,
      type: "CREATE_PAYMENT_LINK",
      status: "APPROVED",
      approvalRequired: false,
      approvedAt: new Date(),
      approvalReason:
        "Test CREATE_PAYMENT_LINK execution",
      payload: {
        source: "test-runner",
      },
    },
  });

console.log("Created CREATE_PAYMENT_LINK action:");

console.log(
  JSON.stringify(
    action,
    (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value,
    2
  )
);

await prisma.$disconnect();