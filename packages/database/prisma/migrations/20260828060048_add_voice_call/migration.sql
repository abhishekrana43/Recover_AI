-- CreateEnum
CREATE TYPE "VoiceCallStatus" AS ENUM ('QUEUED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "VoiceCallOutcome" AS ENUM ('PROMISE_TO_PAY', 'PAYMENT_COMPLETED', 'DECLINED', 'NO_RESPONSE', 'CALL_FAILED');

-- CreateTable
CREATE TABLE "VoiceCall" (
    "id" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCallId" TEXT NOT NULL,
    "status" "VoiceCallStatus" NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "transcript" TEXT,
    "outcome" "PromiseToPayStatus",
    "outcomeData" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCall_providerCallId_key" ON "VoiceCall"("providerCallId");

-- CreateIndex
CREATE INDEX "VoiceCall_recoveryCaseId_idx" ON "VoiceCall"("recoveryCaseId");

-- CreateIndex
CREATE INDEX "VoiceCall_status_idx" ON "VoiceCall"("status");

-- CreateIndex
CREATE INDEX "VoiceCall_createdAt_idx" ON "VoiceCall"("createdAt");

-- AddForeignKey
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
