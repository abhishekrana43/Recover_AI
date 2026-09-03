import { prisma } from "@recover-ai/database";
import { updateVoiceCallStatus } from "../../recovery/voice-call.service.js";

async function run() {
  const voiceCall = await prisma.voiceCall.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!voiceCall) {
    throw new Error("No VoiceCall found.");
  }

  console.log("Testing VoiceCall:", voiceCall.id);
  console.log("Initial status:", voiceCall.status);

  const ringing = await updateVoiceCallStatus(
    voiceCall.providerCallId,
    "RINGING"
  );

  console.log("After RINGING:", ringing.status);

  if (ringing.status !== "RINGING") {
    throw new Error("Expected RINGING");
  }

  const inProgress = await updateVoiceCallStatus(
    voiceCall.providerCallId,
    "IN_PROGRESS"
  );

  console.log("After IN_PROGRESS:", inProgress.status);

  if (inProgress.status !== "IN_PROGRESS") {
    throw new Error("Expected IN_PROGRESS");
  }

  if (!inProgress.answeredAt) {
    throw new Error(
      "answeredAt should be populated"
    );
  }

  const completed = await updateVoiceCallStatus(
    voiceCall.providerCallId,
    "COMPLETED"
  );

  console.log("After COMPLETED:", completed.status);

  if (completed.status !== "COMPLETED") {
    throw new Error("Expected COMPLETED");
  }

  if (!completed.completedAt) {
    throw new Error(
      "completedAt should be populated"
    );
  }

  const previousCompletedAt =
    completed.completedAt;

  const ignored = await updateVoiceCallStatus(
    voiceCall.providerCallId,
    "IN_PROGRESS"
  );

  console.log(
    "After invalid COMPLETED → IN_PROGRESS:",
    ignored.status
  );

  if (ignored.status !== "COMPLETED") {
    throw new Error(
      "Completed call was incorrectly moved backwards"
    );
  }

  if (
    ignored.completedAt?.getTime() !==
    previousCompletedAt.getTime()
  ) {
    throw new Error(
      "completedAt changed after terminal transition"
    );
  }

  console.log(
    "\n✓ Voice call lifecycle test passed"
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "\n✗ Voice call lifecycle test failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}