-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "razorpayOrderId" TEXT,
ADD COLUMN     "razorpayPaymentId" TEXT;

-- AlterTable
ALTER TABLE "WebhookEvent" ALTER COLUMN "provider" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "PaymentAttempt_razorpayOrderId_idx" ON "PaymentAttempt"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_razorpayPaymentId_idx" ON "PaymentAttempt"("razorpayPaymentId");
