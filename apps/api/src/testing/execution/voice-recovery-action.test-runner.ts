import { prisma } from "@recover-ai/database";

const recoveryCaseId = process.argv[2];

if (!recoveryCaseId) {
  throw new Error(
    "Usage: npx tsx src/testing/execution/voice-recovery-action.test-runner.ts <recoveryCaseId>"
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
  !["OPEN", "IN_PROGRESS"].includes(
    recoveryCase.status
  )
) {
  throw new Error(
    `Recovery case is not active: ${recoveryCase.status}`
  );
}

const action =
  await prisma.recoveryAction.create({
    data: {
      recoveryCaseId,
      type: "VOICE_RECOVERY",
      status: "APPROVED",
      payload: {
        source: "voice-recovery-test",
      },
      approvalRequired: false,
      approvedAt: new Date(),
      approvalReason:
        "Test VOICE_RECOVERY execution",
    },
  });

console.log("Created VOICE_RECOVERY action:");
console.log(action);

console.log(
  "\nRun the executor with:"
);

console.log(
  `npx tsx src/testing/execution/action-executor.test-runner.ts ${action.id}`
);