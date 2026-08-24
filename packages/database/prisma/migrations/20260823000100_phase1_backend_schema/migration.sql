-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('RAZORPAY');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'RETRY_PENDING', 'IGNORED');

-- CreateEnum
CREATE TYPE "AgentExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "WebhookEvent"
  ADD COLUMN "provider" "WebhookProvider" NOT NULL DEFAULT 'RAZORPAY',
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN "processingAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "lockedAt" TIMESTAMP(3);

-- Backfill current processed rows into the new lifecycle status.
UPDATE "WebhookEvent"
SET "status" = 'PROCESSED'
WHERE "processed" = true;

-- AlterTable
ALTER TABLE "RecoveryCase"
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "closureReason" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "RecoveryCase" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AgentExecution"
  ADD COLUMN "agentType" TEXT NOT NULL DEFAULT 'RECOVERY_DECISION',
  ADD COLUMN "agentName" TEXT NOT NULL DEFAULT 'recovery-decision',
  ADD COLUMN "status" "AgentExecutionStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "modelVersion" TEXT,
  ADD COLUMN "input" JSONB,
  ADD COLUMN "recommendation" JSONB,
  ADD COLUMN "toolCalls" JSONB,
  ADD COLUMN "policyResult" JSONB,
  ADD COLUMN "rawOutput" JSONB,
  ADD COLUMN "tokenUsage" JSONB,
  ADD COLUMN "latencyMs" INTEGER,
  ADD COLUMN "error" TEXT,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "recommendedAction" DROP NOT NULL,
  ALTER COLUMN "reasoning" DROP NOT NULL;

ALTER TABLE "AgentExecution" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RecoveryAction"
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "error" TEXT,
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "externalProviderId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "scheduledFor" TIMESTAMP(3),
  ADD COLUMN "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedBy" TEXT,
  ADD COLUMN "approvalReason" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "RecoveryAction" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog"
  ADD COLUMN "actorType" TEXT,
  ADD COLUMN "actorId" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "previousState" JSONB,
  ADD COLUMN "newState" JSONB;

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_nextRetryAt_idx" ON "WebhookEvent"("nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_lockedAt_idx" ON "WebhookEvent"("lockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCase_one_active_per_payment_key" ON "RecoveryCase"("paymentId")
WHERE "status" IN ('OPEN', 'IN_PROGRESS', 'ESCALATED');

-- CreateIndex
CREATE INDEX "AgentExecution_status_idx" ON "AgentExecution"("status");

-- CreateIndex
CREATE INDEX "AgentExecution_agentType_idx" ON "AgentExecution"("agentType");

-- CreateIndex
CREATE INDEX "AgentExecution_createdAt_idx" ON "AgentExecution"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryAction_idempotencyKey_key" ON "RecoveryAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RecoveryAction_type_idx" ON "RecoveryAction"("type");

-- CreateIndex
CREATE INDEX "RecoveryAction_scheduledFor_idx" ON "RecoveryAction"("scheduledFor");

-- CreateIndex
CREATE INDEX "RecoveryAction_externalProviderId_idx" ON "RecoveryAction"("externalProviderId");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_actorId_idx" ON "AuditLog"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
