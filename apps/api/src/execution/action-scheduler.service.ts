import { prisma } from "@recover-ai/database";
import { executeRecoveryAction } from "./action-executor.service.js";

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export async function processScheduledActions(): Promise<void> {
  const now = new Date();

  const staleLockTime = new Date(
    now.getTime() - LOCK_TIMEOUT_MS
  );

  const actions = await prisma.recoveryAction.findMany({
    where: {
      type: "WAIT",
      status: "COMPLETED",
      scheduledFor: {
        lte: now,
      },
      OR: [
        {
          lockedAt: null,
        },
        {
          lockedAt: {
            lt: staleLockTime,
          },
        },
      ],
    },
    orderBy: {
      scheduledFor: "asc",
    },
  });

  for (const action of actions) {
    /*
     * Atomic claim.
     *
     * If another worker claims this action first,
     * updateMany() affects zero rows.
     */
    const claimed =
      await prisma.recoveryAction.updateMany({
        where: {
          id: action.id,
          type: "WAIT",
          status: "COMPLETED",
          scheduledFor: {
            lte: now,
          },
          OR: [
            {
              lockedAt: null,
            },
            {
              lockedAt: {
                lt: staleLockTime,
              },
            },
          ],
        },
        data: {
          lockedAt: now,
        },
      });

    if (claimed.count === 0) {
      console.log(
        `WAIT action already claimed, skipping: ${action.id}`
      );

      continue;
    }

    console.log(
      `WAIT action claimed: ${action.id}`
    );

    try {
      /*
       * The WAIT period has finished.
       *
       * For now we only mark the scheduled wait
       * as completed. The workflow continuation
       * layer will decide the next action later.
       */
      const currentResult =
        action.result &&
        typeof action.result === "object" &&
        !Array.isArray(action.result)
          ? action.result
          : {};

      await prisma.recoveryAction.update({
        where: {
          id: action.id,
        },
        data: {
          result: {
            ...currentResult,
            waitCompleted: true,
            completedAt: now.toISOString(),
          },
          lockedAt: null,
        },
      });

      console.log(
        `WAIT action completed: ${action.id}`
      );
    } catch (error) {
      console.error(
        `WAIT action failed: ${action.id}`,
        error
      );

      await prisma.recoveryAction.update({
        where: {
          id: action.id,
        },
        data: {
          lockedAt: null,
          error:
            error instanceof Error
              ? error.message
              : "Unknown scheduled action error",
        },
      });
    }
  }
}