import { prisma } from "@recover-ai/database";

import {
  executeRecoveryAction,
} from "../execution/action-executor.service.js";

const BATCH_SIZE = 10;
const LOCK_TIMEOUT_MS = 60_000;

export async function processRecoveryActions(): Promise<void> {
  const now = new Date();

  const actions =
    await prisma.recoveryAction.findMany({
      where: {
        status: "APPROVED",
        executedAt: null,

        OR: [
          {
            lockedAt: null,
          },
          {
            lockedAt: {
              lt: new Date(
                now.getTime() -
                  LOCK_TIMEOUT_MS
              ),
            },
          },
        ],

        AND: [
          {
            OR: [
              {
                scheduledFor: null,
              },
              {
                scheduledFor: {
                  lte: now,
                },
              },
            ],
          },
        ],
      },

      orderBy: {
        createdAt: "asc",
      },

      take: BATCH_SIZE,
    });

  for (const action of actions) {
    await processRecoveryAction(action.id);
  }
}

async function processRecoveryAction(
  actionId: string
): Promise<void> {
  try {
    console.log(
      `Automatically executing recovery action: ${actionId}`
    );

    await executeRecoveryAction(actionId);

    console.log(
      `Recovery action completed automatically: ${actionId}`
    );
  } catch (error) {
    /*
     * executeRecoveryAction() owns the transition
     * to FAILED and persists the error.
     */
    console.error(
      `Automatic recovery action failed: ${actionId}`,
      error
    );
  }
}