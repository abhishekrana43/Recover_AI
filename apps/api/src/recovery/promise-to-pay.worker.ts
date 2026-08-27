import "dotenv/config";

import { prisma } from "@recover-ai/database";

async function processExpiredPromises() {
  const now = new Date();

  const promises =
    await prisma.promiseToPay.findMany({
      where: {
        status: "PENDING",
        promisedFor: {
          lte: now,
        },
      },
      include: {
        payment: true,
        recoveryCase: true,
      },
    });

  console.log(
    `Found ${promises.length} expired promise(s).`
  );

  for (const promise of promises) {
    /*
     * Customer paid before/during processing.
     */
    if (promise.payment.status === "CAPTURED") {
      await prisma.promiseToPay.update({
        where: {
          id: promise.id,
        },
        data: {
          status: "FULFILLED",
          fulfilledAt: now,
        },
      });

      console.log(
        `Promise fulfilled: ${promise.id}`
      );

      continue;
    }

    /*
     * Promise deadline passed without payment.
     */
    const updated =
      await prisma.promiseToPay.updateMany({
        where: {
          id: promise.id,
          status: "PENDING",
          promisedFor: {
            lte: now,
          },
        },
        data: {
          status: "BROKEN",
          brokenAt: now,
        },
      });

    if (updated.count === 1) {
      console.log(
        `Promise broken: ${promise.id}`
      );
    } else {
      console.log(
        `Promise already processed: ${promise.id}`
      );
    }
  }
}

try {
  await processExpiredPromises();

  console.log(
    "Promise-to-pay worker completed."
  );
} catch (error) {
  console.error(
    "Promise-to-pay worker failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}