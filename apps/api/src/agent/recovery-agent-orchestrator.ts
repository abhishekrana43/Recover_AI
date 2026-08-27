import { prisma } from "@recover-ai/database";
import { buildRecoveryContext } from "./recovery-context.service.js";
import { generateRecoveryRecommendation } from "./recovery-agent.service.js";
import { createRecoveryAction } from "../services/recovery-action.service.js";
import {
  openai,
  recoveryAgentModel,
} from "./openai.client.js";

export async function runRecoveryAgent(
  recoveryCaseId: string
) {
  const startedAt = new Date();

  const context = await buildRecoveryContext(
    recoveryCaseId
  );

  const agentExecution = await prisma.agentExecution.create({
  data: {
    recoveryCaseId,
    model: recoveryAgentModel,
    modelVersion: recoveryAgentModel,
    recommendedAction: "WAIT",
    reasoning: "Agent execution started.",
    confidence: null,
    status: "RUNNING",
    input: context,
    startedAt,
  },
});

  try {
    const recommendation =
     await  generateRecoveryRecommendation(context);

    const actionResult = await createRecoveryAction(
      recoveryCaseId,
      recommendation.action
    );

    const completedAt = new Date();

    const latencyMs =
      completedAt.getTime() - startedAt.getTime();

    const updatedExecution =
      await prisma.agentExecution.update({
        where: {
          id: agentExecution.id,
        },
        data: {
          status: "COMPLETED",
          recommendedAction: recommendation.action,
          reasoning: recommendation.reasoning,
          confidence: recommendation.confidence,
          recommendation,
          policyResult: actionResult.policyResult,
          completedAt,
          latencyMs,
          error: null,
        },
      });

    return {
      context,
      recommendation,
      agentExecution: updatedExecution,
      actionResult,
    };
  } catch (error) {
    const completedAt = new Date();

    const latencyMs =
      completedAt.getTime() - startedAt.getTime();

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown recovery agent error";

    const failedExecution =
      await prisma.agentExecution.update({
        where: {
          id: agentExecution.id,
        },
        data: {
          status: "FAILED",
          completedAt,
          latencyMs,
          error: errorMessage,
        },
      });

    throw Object.assign(
      new Error(errorMessage),
      {
        cause: error,
        agentExecution: failedExecution,
      }
    );
  }
}