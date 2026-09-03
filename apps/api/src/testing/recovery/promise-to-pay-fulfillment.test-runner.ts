import "dotenv/config";

import { prisma } from "@recover-ai/database";

import {
  fulfillPromiseToPay,
} from "../../recovery/promise-to-pay.service.js";

async function run() {
  const promise =
    await prisma.promiseToPay.findFirst({
      where: {
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  if (!promise) {
    throw new Error(
      "No PENDING PromiseToPay found."
    );
  }

  console.log("Before fulfillment:", {
    id: promise.id,
    paymentId: promise.paymentId,
    status: promise.status,
  });

  const fulfilled =
    await fulfillPromiseToPay(
      promise.paymentId
    );

  if (!fulfilled) {
    throw new Error(
      "Expected PromiseToPay to be fulfilled."
    );
  }

  if (fulfilled.status !== "FULFILLED") {
    throw new Error(
      `Expected FULFILLED, got ${fulfilled.status}`
    );
  }

  const updated =
    await prisma.promiseToPay.findUnique({
      where: {
        id: promise.id,
      },
    });

  if (!updated) {
    throw new Error(
      "PromiseToPay disappeared."
    );
  }

  if (updated.status !== "FULFILLED") {
    throw new Error(
      `Database status is ${updated.status}`
    );
  }

  if (!updated.fulfilledAt) {
    throw new Error(
      "fulfilledAt was not set."
    );
  }

  /*
   * Second call must be idempotent.
   */
  const second =
    await fulfillPromiseToPay(
      promise.paymentId
    );

  if (second !== null) {
    throw new Error(
      "Second fulfillment should return null."
    );
  }

  console.log(
    "✓ PromiseToPay fulfillment test passed"
  );
}

try {
  await run();
} catch (error) {
  console.error(
    "PromiseToPay fulfillment test failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}