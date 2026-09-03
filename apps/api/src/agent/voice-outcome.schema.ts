import { z } from "zod";

export const voiceRecoveryOutcomeSchema = z.object({
  outcome: z.enum([
    "PROMISE_TO_PAY",
    "PAYMENT_COMPLETED",
    "DECLINED",
    "NO_RESPONSE",
    "CALL_FAILED",
  ]),

  confidence: z
    .number()
    .min(0)
    .max(1),

  summary: z
    .string()
    .min(1)
    .max(1000),

  promisedFor: z
    .string()
    .datetime()
    .nullable(),
    

  notes: z
    .string()
    .nullable(),
    
});

export type VoiceRecoveryAIOutcome =
  z.infer<typeof voiceRecoveryOutcomeSchema>;