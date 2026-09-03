import {
  openai,
  recoveryAgentModel,
} from "./openai.client.js";

import {
  voiceRecoveryOutcomeSchema,
  type VoiceRecoveryAIOutcome,
} from "./voice-outcome.schema.js";

type VoiceTranscriptInput = {
  transcript: string;
};

const SYSTEM_PROMPT = `
You are Recover-AI's voice payment recovery outcome agent.

Your job is to analyze a customer recovery-call transcript and classify
the customer's payment-recovery outcome.

You do NOT execute payments.
You do NOT create payment links.
You do NOT contact the customer.
You only analyze the conversation and return a structured outcome.

Available outcomes:

PROMISE_TO_PAY
PAYMENT_COMPLETED
DECLINED
NO_RESPONSE
CALL_FAILED

Decision guidelines:

PROMISE_TO_PAY:
- promisedFor can contain a date/time only when the customer actually
  promises to pay.
- Resolve relative dates using currentDateTime.
- "tomorrow" means the calendar day after currentDateTime.
- If no time is provided, use a reasonable time on that date.
- Never use a date from unrelated context.

PAYMENT_COMPLETED:
- promisedFor MUST be null.

DECLINED:
- promisedFor MUST be null.

NO_RESPONSE:
- Use this ONLY when there is no meaningful customer response or the
  transcript is empty.
- Do NOT use NO_RESPONSE for an actual customer statement.

CALL_FAILED:
- Use this when the conversation occurred but the customer's response
  is ambiguous, inconclusive, non-committal, or does not provide enough
  information to classify it as a promise, completed payment, or refusal.
- Examples include:
  "I need to check with my family first."
  "Let me think about it."
  "I need to discuss this first."
- This is different from NO_RESPONSE.

Classification priority:

1. PAYMENT_COMPLETED if the customer says they already paid.
2. PROMISE_TO_PAY if the customer commits to paying later.
3. DECLINED if the customer explicitly refuses to pay.
4. NO_RESPONSE only when there is no meaningful response.
5. CALL_FAILED for an actual conversation that remains ambiguous or
   inconclusive.

confidence must be between 0 and 1.

summary must briefly explain the classification.

promisedFor:
- MUST be null for PAYMENT_COMPLETED, DECLINED, NO_RESPONSE,
  and CALL_FAILED.
- For PROMISE_TO_PAY, return an ISO 8601 datetime when a meaningful
  promised payment date/time can reasonably be determined.
- Return null for PROMISE_TO_PAY when no meaningful payment time can
  be determined.

notes:
- Include useful supporting information from the conversation when
  appropriate.

Do not invent facts that are not present in the transcript.
`;

export async function extractVoiceRecoveryOutcome(
  input: VoiceTranscriptInput
): Promise<VoiceRecoveryAIOutcome> {
  const transcript = input.transcript.trim();

  if (!transcript) {
    return voiceRecoveryOutcomeSchema.parse({
      outcome: "NO_RESPONSE",
      confidence: 1,
      summary: "No conversation transcript was received.",
      promisedFor: null,
      notes: null,
    });
  }

  const response = await openai.responses.create({
    model: recoveryAgentModel,

    instructions: SYSTEM_PROMPT,

    input: JSON.stringify({
      currentDateTime: new Date().toISOString(),
      transcript,
    }),

    text: {
      format: {
        type: "json_schema",
        name: "voice_recovery_outcome",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,

          properties: {
            outcome: {
              type: "string",
              enum: [
                "PROMISE_TO_PAY",
                "PAYMENT_COMPLETED",
                "DECLINED",
                "NO_RESPONSE",
                "CALL_FAILED",
              ],
            },

            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },

            summary: {
              type: "string",
            },

            promisedFor: {
              anyOf: [
                {
                  type: "string",
                  format: "date-time",
                },
                {
                  type: "null",
                },
              ],
            },

            notes: {
              anyOf: [
                {
                  type: "string",
                },
                {
                  type: "null",
                },
              ],
            },
          },

          required: [
            "outcome",
            "confidence",
            "summary",
            "promisedFor",
            "notes",
          ],
        },
      },
    },
  });

  const rawOutput = response.output_text;

  if (!rawOutput) {
    throw new Error(
      "Voice recovery agent returned empty output"
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    throw new Error(
      `Voice recovery agent returned invalid JSON: ${rawOutput}`
    );
  }

  const result =
    voiceRecoveryOutcomeSchema.parse(parsed);

  /*
   * Defensive normalization:
   *
   * Only PROMISE_TO_PAY is allowed to retain promisedFor.
   * This protects the application even if the model returns
   * an inconsistent value.
   */
  if (result.outcome !== "PROMISE_TO_PAY") {
    return voiceRecoveryOutcomeSchema.parse({
      ...result,
      promisedFor: null,
    });
  }

  return result;
}