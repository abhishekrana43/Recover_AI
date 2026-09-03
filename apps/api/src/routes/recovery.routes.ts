import {
  Router,
  type Request,
  type Response,
} from "express";

import { prisma } from "@recover-ai/database";

const router = Router();

router.get(
  "/metrics",
  async (_req: Request, res: Response) => {
    try {
      const cases =
        await prisma.recoveryCase.findMany({
          select: {
            status: true,
            amountAtRisk: true,
            amountRecovered: true,
          },
        });

      const totalCases = cases.length;

      const recoveredCases = cases.filter(
        (item) => item.status === "RECOVERED"
      ).length;

      const openCases = cases.filter(
        (item) => item.status === "OPEN"
      ).length;

      const inProgressCases = cases.filter(
        (item) => item.status === "IN_PROGRESS"
      ).length;

      const failedCases = cases.filter(
        (item) => item.status === "FAILED"
      ).length;

      const escalatedCases = cases.filter(
        (item) => item.status === "ESCALATED"
      ).length;

      const closedCases = cases.filter(
        (item) => item.status === "CLOSED"
      ).length;

      const totalAmountAtRisk =
        cases.reduce(
          (total, item) =>
            total + item.amountAtRisk,
          0
        );

      const totalAmountRecovered =
        cases.reduce(
          (total, item) =>
            total + item.amountRecovered,
          0
        );

      const caseRecoveryRate =
        totalCases === 0
          ? 0
          : Number(
              (
                (recoveredCases /
                  totalCases) *
                100
              ).toFixed(2)
            );

      const amountRecoveryRate =
        totalAmountAtRisk === 0
          ? 0
          : Number(
              (
                (totalAmountRecovered /
                  totalAmountAtRisk) *
                100
              ).toFixed(2)
            );

      return res.status(200).json({
        success: true,
        metrics: {
          totalCases,
          recoveredCases,
          openCases,
          inProgressCases,
          failedCases,
          escalatedCases,
          closedCases,
          totalAmountAtRisk,
          totalAmountRecovered,
          caseRecoveryRate,
          amountRecoveryRate,
        },
      });
    } catch (error) {
      console.error(
        "Recovery metrics lookup failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Recovery metrics lookup failed",
      });
    }
  }
);

router.get(
  "/cases",
  async (_req: Request, res: Response) => {
    try {
      const recoveryCases =
        await prisma.recoveryCase.findMany({
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        });

      const cases = await Promise.all(
        recoveryCases.map(async (recoveryCase) => {
          const payment =
            await prisma.payment.findUnique({
              where: {
                id: recoveryCase.paymentId,
              },
            });

          const customer =
            payment?.customerId
              ? await prisma.customer.findUnique({
                  where: {
                    id: payment.customerId,
                  },
                })
              : null;

          const activePromise =
            await prisma.promiseToPay.findFirst({
              where: {
                recoveryCaseId:
                  recoveryCase.id,
                status: "PENDING",
              },
              orderBy: {
                createdAt: "desc",
              },
            });

          return {
            id: recoveryCase.id,
            status: recoveryCase.status,
            amountAtRisk:
              recoveryCase.amountAtRisk,
            amountRecovered:
              recoveryCase.amountRecovered,
            failureReason:
              recoveryCase.failureReason,
            closureReason:
              recoveryCase.closureReason,
            createdAt:
              recoveryCase.createdAt,
            resolvedAt:
              recoveryCase.resolvedAt,

            payment: payment
              ? {
                  id: payment.id,
                  amount: payment.amount,
                  currency:
                    payment.currency,
                  status: payment.status,
                }
              : null,

            customer: customer
              ? {
                  id: customer.id,
                  name: customer.name,
                  phone: customer.phone,
                }
              : null,

            activePromise:
              activePromise
                ? {
                    id: activePromise.id,
                    promisedFor:
                      activePromise.promisedFor,
                    source:
                      activePromise.source,
                  }
                : null,
          };
        })
      );

      return res.status(200).json({
        success: true,
        cases,
      });
    } catch (error) {
      console.error(
        "Recovery case lookup failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Recovery case lookup failed",
      });
    }
  }
);


router.get(
  "/cases/:recoveryCaseId",
  async (req: Request, res: Response) => {
    try {
      const rawRecoveryCaseId =
        req.params.recoveryCaseId;

      if (
        typeof rawRecoveryCaseId !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid recovery case ID",
        });
      }

      const recoveryCase =
        await prisma.recoveryCase.findUnique({
          where: {
            id: rawRecoveryCaseId,
          },
        });

      if (!recoveryCase) {
        return res.status(404).json({
          success: false,
          message: "Recovery case not found",
        });
      }

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

      const customer = payment.customerId
        ? await prisma.customer.findUnique({
            where: {
              id: payment.customerId,
            },
          })
        : null;

      const promises =
        await prisma.promiseToPay.findMany({
          where: {
            recoveryCaseId:
              recoveryCase.id,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      const actions =
        await prisma.recoveryAction.findMany({
          where: {
            recoveryCaseId:
              recoveryCase.id,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      const voiceCalls =
        await prisma.voiceCall.findMany({
          where: {
            recoveryCaseId:
              recoveryCase.id,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      const auditLogs =
        await prisma.auditLog.findMany({
          where: {
            entityType: "RecoveryCase",
            entityId: recoveryCase.id,
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
          amountRecovered:
            recoveryCase.amountRecovered,
          failureReason:
            recoveryCase.failureReason,
          closureReason:
            recoveryCase.closureReason,
          createdAt:
            recoveryCase.createdAt,
          resolvedAt:
            recoveryCase.resolvedAt,
        },

        customer: customer
          ? {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
            }
          : null,

        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          razorpayPaymentId:
            payment.razorpayPaymentId,
          failureReason:
            payment.failureReason,
        },

        promises,

        actions,

        voiceCalls,

        auditLogs,
      });
    } catch (error) {
      console.error(
        "Recovery case detail lookup failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Recovery case detail lookup failed",
      });
    }
  }
);

export default router;