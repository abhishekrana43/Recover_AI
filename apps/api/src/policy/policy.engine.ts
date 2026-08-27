import type { RecoveryPolicyContext, RecoveryPolicyResult } from "./policy.types.js";

import {
  hasReachedMaximumAttempts,
  isActiveRecoveryStatus,
  isPaymentAlreadyRecovered,
  requiresApproval,
} from "./policy.rules.js";

export function evaluateRecoveryPolicy(
  context: RecoveryPolicyContext
): RecoveryPolicyResult {
  if (!isActiveRecoveryStatus(context.recoveryStatus)) {
    return {
      decision: "BLOCK",
      reason: "RECOVERY_CASE_NOT_ACTIVE",
      approvalRequired: false,
      message: "Recovery case is not active.",
    };
  }

  if (isPaymentAlreadyRecovered(context.paymentStatus)) {
    return {
      decision: "BLOCK",
      reason: "PAYMENT_ALREADY_CAPTURED",
      approvalRequired: false,
      message: "Payment has already been captured.",
    };
  }

  if (hasReachedMaximumAttempts(context.attemptCount)) {
    return {
      decision: "BLOCK",
      reason: "MAX_ATTEMPTS_REACHED",
      approvalRequired: false,
      message: "Maximum payment recovery attempts have been reached.",
    };
  }

  const approvalRequired = requiresApproval(
    context.requestedAction,
    context.amount
  );

  return {
    decision: "ALLOW",
    reason: "ACTION_ALLOWED",
    approvalRequired,
    message: approvalRequired
      ? "Recovery action is allowed but requires approval."
      : "Recovery action is allowed.",
  };
}