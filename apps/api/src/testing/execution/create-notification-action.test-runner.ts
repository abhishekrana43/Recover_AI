import "dotenv/config";
import { prisma } from "@recover-ai/database";

const recoveryCaseId = process.argv[2];

if (!recoveryCaseId) {
  throw new Error(
    "Usage: npx tsx src/execution/create-notification-action.test-runner.ts <recoveryCaseId>"
  );
}

const recoveryCase =
  await prisma.recoveryCase.findUnique({
    where: {
      id: recoveryCaseId,
    },
    include: {
      payment: {
        include: {
          customer: true,
        },
      },
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

const customer =
  recoveryCase.payment.customer;

if (!customer) {
  throw new Error(
    "Customer not found for payment"
  );
}

const recipient =
  customer.phone ??
  customer.email;

if (!recipient) {
  throw new Error(
    "Customer has no phone or email"
  );
}

const action =
  await prisma.recoveryAction.create({
    data: {
      recoveryCaseId,
      type: "SEND_NOTIFICATION",
      status: "APPROVED",
      approvalRequired: false,
      approvedAt: new Date(),
      approvalReason:
        "Test SEND_NOTIFICATION execution",

      payload: {
        channel: customer.phone
          ? "SMS"
          : "EMAIL",

        recipient,

        message:
          "Your payment could not be completed. Please complete your payment to continue.",
      },
    },
  });

console.log(
  "\nCreated SEND_NOTIFICATION action:"
);

console.log(action);

await prisma.$disconnect();