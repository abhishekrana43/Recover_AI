-- CreateTable
CREATE TABLE "VoiceWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCallId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "VoiceWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceWebhookEvent_eventId_key" ON "VoiceWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "VoiceWebhookEvent_providerCallId_idx" ON "VoiceWebhookEvent"("providerCallId");

-- CreateIndex
CREATE INDEX "VoiceWebhookEvent_receivedAt_idx" ON "VoiceWebhookEvent"("receivedAt");

-- CreateIndex
CREATE INDEX "VoiceWebhookEvent_status_idx" ON "VoiceWebhookEvent"("status");
