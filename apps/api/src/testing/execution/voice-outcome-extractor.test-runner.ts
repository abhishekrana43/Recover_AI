import { extractVoiceRecoveryOutcome } from "../../agent/voice-outcome-extractor.js";

const testCases = [
  {
    name: "Payment completed",
    transcript: "I have already paid the amount.",
  },
  {
    name: "Promise to pay",
    transcript: "I will pay tomorrow.",
  },
  {
    name: "Declined",
    transcript: "I don't want to pay.",
  },
  {
    name: "No response",
    transcript: "",
  },
  {
    name: "Unknown conversation",
    transcript: "Can you tell me what this payment is about?",
  },
];

for (const testCase of testCases) {
  const result = await extractVoiceRecoveryOutcome({
    transcript: testCase.transcript,
  });

  console.log(`\n=== ${testCase.name} ===`);
  console.log(result);
}