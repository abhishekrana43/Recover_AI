import { executeRecoveryAction } from "../../execution/action-executor.service.js";

const actionId = process.argv[2];

if (!actionId) {
  throw new Error(
    "Usage: npx tsx src/execution/action-executor.test-runner.ts <actionId>"
  );
}

const result = await executeRecoveryAction(actionId);

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