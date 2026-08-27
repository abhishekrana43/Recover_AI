import { openai, recoveryAgentModel } from "./openai.client.js";
import {
  recoveryAgentRecommendationSchema,
  type RecoveryAgentRecommendation,
} from "./recovery-agent.schema.js";

import type { RecoveryContext } from "./recovery-agent.types.js";

const SYSTEM_PROMPT = `
You are Recover-AI's payment recovery decision agent.

Your job is to recommend exactly ONE recovery action for a failed payment.

You do NOT execute payments.
You do NOT call external APIs.
You do NOT override policy.
You only recommend an action.

Available actions:

RETRY_PAYMENT
CREATE_PAYMENT_LINK
SEND_NOTIFICATION
WAIT
ESCALATE

Decision guidelines:

- Prefer RETRY_PAYMENT when the payment has failed and there are very few attempts.
- Prefer CREATE_PAYMENT_LINK when repeated attempts have failed.
- Prefer SEND_NOTIFICATION when customer communication is appropriate.
- Prefer WAIT when immediate recovery is not appropriate.
- Prefer ESCALATE when automated recovery is unsafe or inappropriate.

Return:
- action: exactly one allowed action
- reasoning: concise explanation for the recommendation
- confidence: number between 0 and 1

The policy engine is the final authority.
Your recommendation can be rejected by the policy engine.
`;

export async function generateRecoveryRecommendation(
  context: RecoveryContext
): Promise<RecoveryAgentRecommendation> {
  const response = await openai.responses.create({
    model: recoveryAgentModel,

    instructions: SYSTEM_PROMPT,

    input: JSON.stringify(context),

    text: {
      format: {
        type: "json_schema",
        name: "recovery_agent_recommendation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            action: {
              type: "string",
              enum: [
                "RETRY_PAYMENT",
                "CREATE_PAYMENT_LINK",
                "SEND_NOTIFICATION",
                "WAIT",
                "ESCALATE",
              ],
            },
            reasoning: {
              type: "string",
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
          },
          required: [
            "action",
            "reasoning",
            "confidence",
          ],
        },
      },
    },
  });

  const rawOutput = response.output_text;

  if (!rawOutput) {
    throw new Error(
      "Recovery agent returned empty output"
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    throw new Error(
      `Recovery agent returned invalid JSON: ${rawOutput}`
    );
  }

  return recoveryAgentRecommendationSchema.parse(parsed);
}