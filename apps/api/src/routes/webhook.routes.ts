import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { dispatchWebhookEvent } from "../events/event.dispatcher.js";
import { prisma } from "@recover-ai/database";
import {handleVoiceWebhook,} from "../events/voice-webhook-idempotency.service.js";
import {voiceConfig,} from "../config/voice.js";

import {verifyVoiceWebhookSignature,} from "../providers/voice/voice-webhook.security.js";

import type {VoiceCallStatus,} from "../providers/voice/voice-provider.types.js";

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

router.post(
  "/voice",
  async (req: Request, res: Response) => {
    try {
      const rawBody = req.body as Buffer;

const webhookSecret =
  voiceConfig.webhookSecret;

if (!webhookSecret) {
  console.error(
    "Voice webhook secret is not configured"
  );

  return res.status(500).json({
    success: false,
    message: "Voice webhook configuration error",
  });
}

const signature =
  req.headers["x-voice-signature"];

if (typeof signature !== "string") {
  return res.status(400).json({
    success: false,
    message: "Missing voice signature",
  });
}

const isValid =
  verifyVoiceWebhookSignature(
    rawBody,
    signature,
    webhookSecret
  );

if (!isValid) {
  return res.status(401).json({
    success: false,
    message: "Invalid voice webhook signature",
  });
}

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

if (
  typeof payload !== "object" ||
  payload === null
) {
  return res.status(400).json({
    success: false,
    message: "Invalid voice webhook payload",
  });
}

const data =
  payload as Record<string, unknown>;

      const eventId =
        req.headers["x-voice-event-id"];

      if (typeof eventId !== "string") {
        return res.status(400).json({
          success: false,
          message: "Missing voice event ID",
        });
      }

      const providerCallId =
        data.providerCallId;

      if (typeof providerCallId !== "string") {
        return res.status(400).json({
          success: false,
          message:
            "Missing provider call ID",
        });
      }

      const provider = data.provider;

      if (typeof provider !== "string") {
        return res.status(400).json({
          success: false,
          message: "Missing voice provider",
        });
      }

      const status = data.status;

      if (
        status !== undefined &&
        typeof status !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid voice call status",
        });
      }

      const transcript =
        data.transcript;

      if (
        transcript !== undefined &&
        typeof transcript !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid transcript",
        });
      }

      const failureReason =
        data.failureReason;

      if (
        failureReason !== undefined &&
        typeof failureReason !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid failure reason",
        });
      }

      const event = {
        eventId,
        provider,
        providerCallId,
        ...(status !== undefined
          ? {
              status:
                status as VoiceCallStatus,
            }
          : {}),
        ...(transcript !== undefined
          ? { transcript }
          : {}),
        ...(failureReason !== undefined
          ? { failureReason }
          : {}),
      };

      const result =
        await handleVoiceWebhook(
          event,
          payload
        );

      return res.status(200).json({
        success: true,
        eventId,
        duplicate: result.duplicate,
      });
    } catch (error) {
      console.error(
        "Voice webhook processing failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Voice webhook processing failed",
      });
    }
  }
);

router.post(
  "/sarvam",
  async (req: Request, res: Response) => {
    try {
      const rawPayload = req.body;

      if (
        typeof rawPayload !== "object" ||
        rawPayload === null ||
        Array.isArray(rawPayload)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid Sarvam webhook payload",
        });
      }

      const payload =
        rawPayload as Record<string, unknown>;

      /*
       * Sarvam webhook metadata should contain:
       *
       * recovery_case_id
       *
       * The recovery case is already associated with
       * the VoiceCall created by Recover-AI.
       */

      const metadata =
        typeof payload.metadata === "object" &&
        payload.metadata !== null &&
        !Array.isArray(payload.metadata)
          ? (
              payload.metadata as Record<
                string,
                unknown
              >
            )
          : {};

      const recoveryCaseId =
        typeof metadata.recovery_case_id ===
        "string"
          ? metadata.recovery_case_id
          : undefined;

      if (!recoveryCaseId) {
        return res.status(400).json({
          success: false,
          message:
            "Missing recovery_case_id in Sarvam webhook metadata",
        });
      }

      /*
       * We need the Sarvam call identifier.
       *
       * Support the common identifier locations
       * without assuming one exact response shape.
       */
      
      const providerCallId =
           typeof payload.providerCallId === "string"
                  ? payload.providerCallId
                  : typeof payload.call_id === "string"
                  ? payload.call_id
                  : typeof payload.callId === "string"
                  ? payload.callId
                  : typeof payload.outbound_id === "string"
                  ? payload.outbound_id
                  : typeof payload.attempt_id === "string"
                  ? payload.attempt_id
                  : undefined;
                 if (!providerCallId) {
                    return res.status(400).json({
                          success: false,
                          message:
                          "Missing Sarvam call identifier",
                   });
             }

      /*
       * Extract call status.
       */
      const rawStatus =
        typeof payload.status === "string"
          ? payload.status.toUpperCase()
          : undefined;

      //  const status =
      //   rawStatus === "QUEUED" ||
      //   rawStatus === "RINGING" ||
      //   rawStatus === "IN_PROGRESS" ||
      //   rawStatus === "COMPLETED" ||
      //   rawStatus === "FAILED"
      //     ? rawStatus
      //     : undefined;

      function normalizeSarvamStatus(
  value: unknown
): VoiceCallStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  switch (value.toUpperCase()) {
    case "QUEUED":
      return "QUEUED";

    case "RINGING":
      return "RINGING";

    case "IN_PROGRESS":
      return "IN_PROGRESS";

    case "COMPLETED":
      return "COMPLETED";

    case "FAILED":
      return "FAILED";

    default:
      return undefined;
  }
}
     
     const status =
              normalizeSarvamStatus(
              payload.status
             );
      

      /*
       * Extract transcript.
       *
       * Sarvam may proconst statusvide it directly or inside
       * a result/output object depending on the
       * configured webhook payload.
       */
      let transcript: string | undefined;

      if (
        typeof payload.transcript ===
        "string"
      ) {
        transcript =
          payload.transcript;
      } else if (
        typeof payload.result === "object" &&
        payload.result !== null &&
        !Array.isArray(payload.result)
      ) {
        const result =
          payload.result as Record<
            string,
            unknown
          >;

        if (
          typeof result.transcript ===
          "string"
        ) {
          transcript =
            result.transcript;
        }
      }

      /*
       * Extract failure reason when available.
       */
      const failureReason =
        typeof payload.failure_reason ===
        "string"
          ? payload.failure_reason
          : typeof payload.failureReason ===
              "string"
            ? payload.failureReason
            : undefined;

      /*
       * Sarvam webhook events need a stable event ID
       * for our existing idempotency layer.
       */
      const eventId =
        typeof payload.event_id ===
        "string"
          ? payload.event_id
          : typeof payload.eventId ===
              "string"
            ? payload.eventId
            : `${providerCallId}_${status ?? "EVENT"}`;

      /*
       * Normalize Sarvam -> Recover-AI event.
       */
      const event = {
        eventId,
        provider: "SARVAM",
        providerCallId,

        ...(status !== undefined
          ? {
              status,
            }
          : {}),

        ...(transcript !== undefined
          ? {
              transcript,
            }
          : {}),

        ...(failureReason !== undefined
          ? {
              failureReason,
            }
          : {}),
      };

      /*
       * Confirm that the VoiceCall belongs to the
       * recovery case supplied by Sarvam metadata.
       */
      const voiceCall =
        await prisma.voiceCall.findUnique({
          where: {
            providerCallId,
          },
        });

      if (!voiceCall) {
        return res.status(404).json({
          success: false,
          message:
            "Voice call not found",
        });
      }

      if (
        voiceCall.recoveryCaseId !==
        recoveryCaseId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Sarvam webhook recovery case does not match voice call",
        });
      }

      /*
       * Reuse our existing voice webhook
       * idempotency + processing pipeline.
       */
      const result =
        await handleVoiceWebhook(
          event,
          payload
        );

      return res.status(200).json({
        success: true,
        provider: "SARVAM",
        eventId,
        duplicate:
          result.duplicate,
      });
    } catch (error) {
      console.error(
        "Sarvam webhook processing failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Sarvam webhook processing failed",
      });
    }
  }
);

export default router;