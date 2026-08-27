import type {
  RecoveryActionType,
  RecoveryStatus,
  PaymentStatus,
} from "./policy.types.js";

export const MAX_PAYMENT_ATTEMPTS = 3;

export const HIGH_VALUE_PAYMENT_AMOUNT = 100_000;

export function isActiveRecoveryStatus(
  status: RecoveryStatus
): boolean {
  return (
    status === "OPEN" ||
    status === "IN_PROGRESS" ||
    status === "ESCALATED"
  );
}

export function isPaymentAlreadyRecovered(
  status: PaymentStatus
): boolean {
  return status === "CAPTURED";
}

export function hasReachedMaximumAttempts(
  attemptCount: number
): boolean {
  return attemptCount >= MAX_PAYMENT_ATTEMPTS;
}

export function requiresApproval(
  action: RecoveryActionType,
  amount: number
): boolean {
  if (amount >= HIGH_VALUE_PAYMENT_AMOUNT) {
    return true;
  }

  return action === "CREATE_PAYMENT_LINK";
}