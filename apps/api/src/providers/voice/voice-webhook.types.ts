import type { VoiceCallStatus } from "./voice-provider.types.js";

export type VoiceWebhookEvent = {
  eventId: string;
  provider: string;
  providerCallId: string;
  status?: VoiceCallStatus;
  transcript?: string;
  failureReason?: string;
};