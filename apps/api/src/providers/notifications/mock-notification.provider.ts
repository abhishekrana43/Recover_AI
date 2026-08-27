import type {
  SendNotificationInput,
  SendNotificationResult,
} from "./notifications-provider.types.js";

export class MockNotificationProvider {
  async send(
    input: SendNotificationInput
  ): Promise<SendNotificationResult> {
    const externalProviderId =
      `mock_msg_${Date.now()}`;

    console.log("Sending recovery notification:", {
      externalProviderId,
      channel: input.channel,
      recipient: input.recipient,
      message: input.message,
      recoveryCaseId: input.recoveryCaseId,
    });

    return {
      success: true,
      provider: "MOCK",
      externalProviderId,
      result: {
        messageId: externalProviderId,
        channel: input.channel,
        recipient: input.recipient,
        message: input.message,
        status: "sent",
      },
    };
  }
}

export const mockNotificationProvider =
new MockNotificationProvider();