import type { Prisma } from "@recover-ai/database/src/generated/client.js";

export type SendNotificationInput = {
  recoveryCaseId: string;
  paymentId: string;
  channel: "SMS" | "EMAIL" | "WHATSAPP";
  recipient: string;
  message: string;
};

export type SendNotificationResult = {
  success: boolean;
  provider: "MOCK";
  externalProviderId?: string;
  result?: Prisma.InputJsonValue;
  error?: string;
};