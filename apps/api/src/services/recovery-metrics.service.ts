import { prisma } from "@recover-ai/database";

export type RecoveryBatchMetrics = {
  totalCases: number;
  recoveredCases: number;
  openCases: number;
  inProgressCases: number;
  failedCases: number;
  escalatedCases: number;
  closedCases: number;

  totalAmountAtRisk: number;
  totalAmountRecovered: number;

  caseRecoveryRate: number;
  amountRecoveryRate: number;
};

export async function getRecoveryBatchMetrics(): Promise<RecoveryBatchMetrics> {
  const cases = await prisma.recoveryCase.findMany({
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

  const totalAmountAtRisk = cases.reduce(
    (total, item) =>
      total + item.amountAtRisk,
    0
  );

  const totalAmountRecovered = cases.reduce(
    (total, item) =>
      total + item.amountRecovered,
    0
  );

  const caseRecoveryRate =
    totalCases === 0
      ? 0
      : Number(
          (
            (recoveredCases / totalCases) *
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

  return {
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
  };
}