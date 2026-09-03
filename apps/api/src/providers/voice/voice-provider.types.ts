export type VoiceCallStatus =
  | "QUEUED"
  | "RINGING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

export type VoiceCallInput = {
  recoveryCaseId: string;
  customerName: string;
  phoneNumber: string;
  amount: number;
  currency: string;
  paymentLink?: string;

  language?: "HINGLISH" | "HI" | "EN";
  agentId?: string;
};

export type VoiceCallResult = {
  success: boolean;
  provider: string;
  providerCallId?: string;
  status?: VoiceCallStatus;
  result?: Record<string, unknown>;
  error?: string;
};

export interface VoiceProvider {
  initiateCall(
    input: VoiceCallInput
  ): Promise<VoiceCallResult>;

  getCallStatus(
    providerCallId: string
  ): Promise<VoiceCallResult>;
}