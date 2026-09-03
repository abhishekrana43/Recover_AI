import crypto from "crypto";

import type {
  VoiceCallInput,
  VoiceCallResult,
  VoiceProvider,
} from "./voice-provider.types.js";

export class MockVoiceProvider implements VoiceProvider {
  async initiateCall(
    input: VoiceCallInput
  ): Promise<VoiceCallResult> {
    const providerCallId =
      `mock_call_${crypto.randomUUID()}`;

    console.log(
      `[MOCK VOICE] Initiating recovery call`
    );

    console.log({
      providerCallId,
      recoveryCaseId: input.recoveryCaseId,
      customerName: input.customerName,
      phoneNumber: input.phoneNumber,
      amount: input.amount,
      currency: input.currency,
      paymentLink: input.paymentLink,
    });

    return {
      success: true,
      provider: "MOCK",
      providerCallId,
      status: "QUEUED",
      result: {
        providerCallId,
        message: "Mock voice call queued",
      },
    };
  }

  async getCallStatus(
    providerCallId: string
  ): Promise<VoiceCallResult> {
    return {
      success: true,
      provider: "MOCK",
      providerCallId,
      status: "COMPLETED",
      result: {
        outcome: "CUSTOMER_CONTACTED",
      },
    };
  }
}

export const mockVoiceProvider =
  new MockVoiceProvider();