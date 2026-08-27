export type PaymentStatus =
  | "CREATED"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "REFUNDED";

export type RecoveryStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RECOVERED"
  | "FAILED"
  | "ESCALATED"
  | "CLOSED";

export type RecoveryActionType =
  | "RETRY_PAYMENT"
  | "CREATE_PAYMENT_LINK"
  | "SEND_NOTIFICATION"
  | "WAIT"
  | "ESCALATE";

export type ActionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED";

export type PolicyDecision = "ALLOW" | "BLOCK";

export type PolicyReason =
  | "RECOVERY_CASE_NOT_ACTIVE"
  | "PAYMENT_ALREADY_CAPTURED"
  | "MAX_ATTEMPTS_REACHED"
  | "ACTION_NOT_SUPPORTED"
  | "HIGH_VALUE_REQUIRES_APPROVAL"
  | "ACTION_ALLOWED";

export type RecoveryPolicyContext = {
  recoveryCaseId: string;
  paymentId: string;
  paymentStatus: PaymentStatus;
  recoveryStatus: RecoveryStatus;
  amount: number;
  attemptCount: number;
  requestedAction: RecoveryActionType;
  currentActionStatus?: ActionStatus;
};

export type RecoveryPolicyResult = {
  decision: PolicyDecision;
  reason: PolicyReason;
  approvalRequired: boolean;
  message: string;
};