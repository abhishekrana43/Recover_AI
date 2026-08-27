import { createRecoveryAction } from "./recovery-action.service.js";

const recoveryCaseId = process.argv[2];

if (!recoveryCaseId) {
  throw new Error(
    "Usage: npx tsx apps/api/src/services/recovery-action.test-runner.ts <recoveryCaseId>"
  );
}

const result = await createRecoveryAction(
  recoveryCaseId,
  "RETRY_PAYMENT"
);

console.log(
  JSON.stringify(
    result,
    (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value,
    2
  )
);