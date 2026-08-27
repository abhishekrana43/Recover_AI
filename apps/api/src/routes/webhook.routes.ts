import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { dispatchWebhookEvent } from "../events/event.dispatcher.js";
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

      const signature = req.headers["x-razorpay-signature"];

      if (typeof signature !== "string") {
        return res.status(400).json({
          success: false,
          message: "Missing Razorpay signature",
        });
      }

      const rawBody = req.body as Buffer;

      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      const receivedSignature = Buffer.from(signature);
      const calculatedSignature = Buffer.from(expectedSignature);

      const isValid =
        receivedSignature.length === calculatedSignature.length &&
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

      const eventId = req.headers["x-razorpay-event-id"];

      if (typeof eventId !== "string") {
        return res.status(400).json({
          success: false,
          message: "Missing Razorpay event ID",
        });
      }

      let payload: unknown;

      try {
        payload = JSON.parse(rawBody.toString("utf8"));
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

      let webhookEvent;

      try {
        webhookEvent = await prisma.webhookEvent.create({
          data: {
            eventId,
            eventType,
            provider: "RAZORPAY",
            payload: payload as object,
            processed: false,
            status: "RECEIVED",
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const existingEvent = await prisma.webhookEvent.findUnique({
            where: {
              eventId,
            },
          });

          if (!existingEvent) {
            throw error;
          }

          if ( existingEvent.status === "PROCESSED" ||
               existingEvent.status === "PROCESSING") {
            console.log(
              `Duplicate processed webhook ignored: ${eventId}`
            );

            return res.status(200).json({
              success: true,
              duplicate: true,
              eventId,
            });
          }

          webhookEvent = existingEvent;
        } else {
          throw error;
        }
      }

      await prisma.webhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          status: "PROCESSING",
          processingAttempts: {
            increment: 1,
          },
          lastError: null,
        },
      });

      console.log("Processing Razorpay webhook:", {
        eventId,
        eventType,
      });

      try {
        await dispatchWebhookEvent(eventType, payload);

        await prisma.webhookEvent.update({
          where: {
            id: webhookEvent.id,
          },
          data: {
            status: "PROCESSED",
            processed: true,
            processedAt: new Date(),
            lastError: null,
          },
        });

        return res.status(200).json({
          success: true,
          eventId,
          eventType,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown webhook processing error";

        const attempts = webhookEvent.processingAttempts;

const maxAttempts = 5;

const shouldRetry = attempts < maxAttempts;

await prisma.webhookEvent.update({
  where: {
    id: webhookEvent.id,
  },
  data: {
    status: shouldRetry ? "RETRY_PENDING" : "FAILED",
    processed: false,
    lastError: errorMessage,
    nextRetryAt: shouldRetry
      ? new Date(Date.now() + Math.pow(2, attempts) * 1000)
      : null,
  },
});

        console.error(
          "Razorpay webhook processing failed:",
          {
            eventId,
            eventType,
            error,
          }
        );

        return res.status(500).json({
          success: false,
          message: "Webhook processing failed",
        });
      }
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