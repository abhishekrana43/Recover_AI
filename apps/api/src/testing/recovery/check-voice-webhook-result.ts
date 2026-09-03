import "dotenv/config";

import { prisma } from "@recover-ai/database";

async function main() {
  const providerCallId =
    "878eae7c-efbf-400f-8059-6e6610aaf4f5";

  const voiceCall =
    await prisma.voiceCall.findUnique({
      where: {
        providerCallId,
      },
      include: {
        recoveryCase: true,
      },
    });

  console.log("\n=== VOICE CALL ===\n");

  console.dir(voiceCall, {
    depth: null,
  });

  if (!voiceCall) {
    return;
  }

  const promises =
    await prisma.promiseToPay.findMany({
      where: {
        recoveryCaseId:
          voiceCall.recoveryCaseId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  console.log("\n=== PROMISE TO PAY ===\n");

  console.dir(promises, {
    depth: null,
  });
}

main()
  .catch((error) => {
    console.error(
      "Failed to inspect webhook result:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });