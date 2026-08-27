import { z } from "zod";

export const recoveryAgentRecommendationSchema = z.object({
  action: z.enum([
    "RETRY_PAYMENT",
    "CREATE_PAYMENT_LINK",
    "SEND_NOTIFICATION",
    "WAIT",
    "ESCALATE",
  ]),
  reasoning: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
});

export type RecoveryAgentRecommendation = z.infer<
  typeof recoveryAgentRecommendationSchema
>;