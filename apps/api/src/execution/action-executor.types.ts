import type { RecoveryActionType } from "../policy/policy.types.js";
import type { Prisma } from "@recover-ai/database/src/generated/client.js";

export type ActionExecutionResult = {
  success: boolean;
  action: string;
  result?: Prisma.InputJsonValue;
  externalProviderId?: string;
  error?: string;
};