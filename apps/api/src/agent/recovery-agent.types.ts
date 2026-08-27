import type {
  PaymentStatus,
  RecoveryStatus,
  RecoveryActionType,
} from "../policy/policy.types.js";

export type RecoveryContext = {
  recoveryCaseId: string;
  paymentId: string;

  payment: {
    status: PaymentStatus;
    amount: number;
    currency: string;
    failureReason: string | null;
  };

  recoveryCase: {
    status: RecoveryStatus;
    amountAtRisk: number;
    amountRecovered: number;
    failureReason: string | null;
  };

  attempts: {
    attemptNumber: number;
    status: PaymentStatus;
    failureReason: string | null;
    attemptedAt: string;
  }[];

  availableActions: RecoveryActionType[];
};

export type RecoveryAgentRecommendation = {
  action: RecoveryActionType;
  reasoning: string;
  confidence: number;
};