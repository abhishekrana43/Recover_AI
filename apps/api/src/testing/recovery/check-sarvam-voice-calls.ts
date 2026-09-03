import "dotenv/config";

import { prisma } from "@recover-ai/database";

async function main() {
  const calls = await prisma.voiceCall.findMany({
    where: {
      provider: "SARVAM",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log("\n=== RECENT SARVAM VOICE CALLS ===\n");

  for (const call of calls) {
    console.log({
      id: call.id,
      recoveryCaseId: call.recoveryCaseId,
      provider: call.provider,
      providerCallId: call.providerCallId,
      status: call.status,
      createdAt: call.createdAt,
      failureReason: call.failureReason,
    });
  }
}

main()
  .catch((error) => {
    console.error(
      "Failed to read Sarvam voice calls:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });