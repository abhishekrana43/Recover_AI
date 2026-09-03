export type VoiceRecoveryOutcome =
  | "PROMISE_TO_PAY"
  | "PAYMENT_COMPLETED"
  | "DECLINED"
  | "NO_RESPONSE"
  | "CALL_FAILED";

export type VoiceRecoveryResult = {
  outcome: VoiceRecoveryOutcome;
  confidence: number;
  summary: string;
  promisedFor?: Date;
  notes?: string;
};