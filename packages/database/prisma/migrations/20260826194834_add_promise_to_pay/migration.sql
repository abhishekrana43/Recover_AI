-- CreateEnum
CREATE TYPE "PromiseToPayStatus" AS ENUM ('PENDING', 'FULFILLED', 'BROKEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PromiseToPaySource" AS ENUM ('VOICE', 'SMS', 'WHATSAPP', 'EMAIL', 'MANUAL');

-- CreateTable
CREATE TABLE "PromiseToPay" (
    "id" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "promisedFor" TIMESTAMP(3) NOT NULL,
    "status" "PromiseToPayStatus" NOT NULL DEFAULT 'PENDING',
    "source" "PromiseToPaySource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "brokenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromiseToPay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromiseToPay_recoveryCaseId_idx" ON "PromiseToPay"("recoveryCaseId");

-- CreateIndex
CREATE INDEX "PromiseToPay_paymentId_idx" ON "PromiseToPay"("paymentId");

-- CreateIndex
CREATE INDEX "PromiseToPay_status_idx" ON "PromiseToPay"("status");

-- CreateIndex
CREATE INDEX "PromiseToPay_promisedFor_idx" ON "PromiseToPay"("promisedFor");

-- AddForeignKey
ALTER TABLE "PromiseToPay" ADD CONSTRAINT "PromiseToPay_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseToPay" ADD CONSTRAINT "PromiseToPay_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
