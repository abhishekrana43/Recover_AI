-- AlterTable
ALTER TABLE "RecoveryAction" ADD COLUMN     "lockedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RecoveryAction_lockedAt_idx" ON "RecoveryAction"("lockedAt");
