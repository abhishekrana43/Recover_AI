import { extractVoiceRecoveryOutcome } from "../../agent/voice-outcome-extractor.js";

const testCases = [
  {
    name: "Payment completed",
    transcript:
      "I have already paid the amount. Please check your records.",
    expected: "PAYMENT_COMPLETED",
  },
  {
    name: "Promise tomorrow",
    transcript:
      "I haven't paid yet. I will pay tomorrow.",
    expected: "PROMISE_TO_PAY",
  },
  {
    name: "Promise today",
    transcript:
      "I will make the payment later today.",
    expected: "PROMISE_TO_PAY",
  },
  {
    name: "Declined",
    transcript:
      "I don't want to pay this amount.",
    expected: "DECLINED",
  },
  {
    name: "No response",
    transcript: "",
    expected: "NO_RESPONSE",
  },
  {
    name: "Ambiguous",
    transcript:
      "I need to check with my family first.",
    expected: "CALL_FAILED",
  },
];

async function run() {
  for (const testCase of testCases) {
    console.log(`\n=== ${testCase.name} ===`);

    const result =
      await extractVoiceRecoveryOutcome({
        transcript: testCase.transcript,
      });

    
      if (result.outcome !== testCase.expected) {
            throw new Error(
           `${testCase.name}: expected ${testCase.expected}, got ${result.outcome}`
      );
    }

    if (
           result.outcome !== "PROMISE_TO_PAY" &&
           result.promisedFor !== null
       ) {
          throw new Error(
         `${testCase.name}: promisedFor must be null for ${result.outcome}`
         );
       }

    console.log(result);
  }
}

try {
  await run();
} catch (error) {
  console.error("Voice outcome test failed:", error);
  process.exitCode = 1;
}