import {
  Router,
  type Request,
  type Response,
} from "express";

import { prisma } from "@recover-ai/database";
import { requireVoiceAgentAuth } from "./middleware/voice-agent-auth.js";

const router = Router();

router.get(
  "/context/:recoveryCaseId",
  requireVoiceAgentAuth,
  async (req: Request, res: Response) => {
    try {
      
        const rawRecoveryCaseId = req.params.recoveryCaseId;

if (typeof rawRecoveryCaseId !== "string") {
  return res.status(400).json({
    success: false,
    message: "Invalid recovery case ID",
  });
}

const recoveryCaseId = rawRecoveryCaseId;

      /*
       * Get the recovery case itself.
       */
      const recoveryCase =
        await prisma.recoveryCase.findUnique({
          where: {
            id: recoveryCaseId,
          },
        });

      if (!recoveryCase) {
        return res.status(404).json({
          success: false,
          message: "Recovery case not found",
        });
      }

      /*
       * Get the payment separately.
       */
      const payment =
        await prisma.payment.findUnique({
          where: {
            id: recoveryCase.paymentId,
          },
        });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      /*
       * Customer is optional on Payment.
       */
      const customer = payment.customerId
        ? await prisma.customer.findUnique({
            where: {
              id: payment.customerId,
            },
          })
        : null;

      /*
       * Get the latest active PromiseToPay.
       */
      const activePromise =
        await prisma.promiseToPay.findFirst({
          where: {
            recoveryCaseId: recoveryCase.id,
            status: "PENDING",
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      return res.status(200).json({
        success: true,

        recoveryCase: {
          id: recoveryCase.id,
          status: recoveryCase.status,
          amountAtRisk:
            recoveryCase.amountAtRisk,
          currency: payment.currency,
          failureReason:
            recoveryCase.failureReason,
        },

        customer: {
          id: customer?.id ?? null,
          name: customer?.name ?? null,
          phone: customer?.phone ?? null,
        },

        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
        },

        activePromise: activePromise
          ? {
              id: activePromise.id,
              promisedFor:
                activePromise.promisedFor,
              source:
                activePromise.source,
              notes:
                activePromise.notes,
            }
          : null,
      });
    } catch (error) {
      console.error(
        "Voice agent context lookup failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Voice agent context lookup failed",
      });
    }
  }
);

export default router;