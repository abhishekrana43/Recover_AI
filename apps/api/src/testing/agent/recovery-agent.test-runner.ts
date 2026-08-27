import { runRecoveryAgent } from "../../agent/recovery-agent-orchestrator.js";

const recoveryCaseId = process.argv[2];

if (!recoveryCaseId) {
  throw new Error(
    "Usage: npx tsx src/agent/recovery-agent.test-runner.ts <recoveryCaseId>"
  );
}

const result = await runRecoveryAgent(
  recoveryCaseId
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