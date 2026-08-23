import { Router, type Request, type Response } from "express";
import crypto from "crypto";

import { prisma } from "@recover-ai/database";

const router = Router();

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

router.post(
  "/razorpay",
  async (req: Request, res: Response) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("Razorpay webhook secret is not configured");

        return res.status(500).json({
          success: false,
          message: "Webhook configuration error",
        });
      }

      // --------------------------------------------------
      // 1. Get Razorpay signature
      // --------------------------------------------------

      const signature =
        req.headers["x-razorpay-signature"];

      if (typeof signature !== "string") {
        return res.status(400).json({
          success: false,
          message: "Missing Razorpay signature",
        });
      }

      // --------------------------------------------------
      // 2. Get raw request body
      // --------------------------------------------------

      const rawBody = req.body as Buffer;

      // --------------------------------------------------
      // 3. Generate expected signature
      // --------------------------------------------------

      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      // --------------------------------------------------
      // 4. Compare signatures safely
      // --------------------------------------------------

      const receivedSignature =
        Buffer.from(signature);

      const calculatedSignature =
        Buffer.from(expectedSignature);

      const isValid =
        receivedSignature.length ===
          calculatedSignature.length &&
        crypto.timingSafeEqual(
          receivedSignature,
          calculatedSignature
        );

      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid webhook signature",
        });
      }

      // --------------------------------------------------
      // 5. Get Razorpay event ID
      // --------------------------------------------------

      const eventId =
        req.headers["x-razorpay-event-id"];

      if (typeof eventId !== "string") {
        return res.status(400).json({
          success: false,
          message: "Missing Razorpay event ID",
        });
      }

      // --------------------------------------------------
      // 6. Parse webhook payload
      // --------------------------------------------------

      let payload: unknown;

      try {
        payload = JSON.parse(
          rawBody.toString("utf8")
        );
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON payload",
        });
      }

      const eventType =
        typeof payload === "object" &&
        payload !== null &&
        "event" in payload
          ? payload.event
          : undefined;

      if (typeof eventType !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid webhook event type",
        });
      }

      // --------------------------------------------------
      // 7. Check for duplicate webhook
      // --------------------------------------------------

      try {
        await prisma.webhookEvent.create({
          data: {
            eventId,
            eventType,
            processed: true,
            processedAt: new Date(),
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          console.log(
            `Duplicate Razorpay webhook ignored: ${eventId}`
          );

          return res.status(200).json({
            success: true,
            duplicate: true,
          });
        }

        throw error;
      }

      // --------------------------------------------------
      // 8. Log verified event
      // --------------------------------------------------

      console.log(
        "Verified Razorpay webhook:",
        {
          eventId,
          eventType,
        }
      );

      // --------------------------------------------------
      // 9. Temporary response
      // --------------------------------------------------

      return res.status(200).json({
        success: true,
        eventId,
        eventType,
      });

    } catch (error) {
      console.error(
        "Razorpay webhook error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Webhook processing failed",
      });
    }
  }
);

export default router;
