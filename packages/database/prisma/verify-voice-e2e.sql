SELECT
  "providerCallId",
  "status"::text AS status,
  "outcome"::text AS outcome,
  "transcript"
FROM "VoiceCall"
ORDER BY "createdAt" DESC
LIMIT 3;

SELECT
  "eventId",
  "status",
  "processed"
FROM "VoiceWebhookEvent"
WHERE "eventId" = 'voice_e2e_001';

SELECT
  "status",
  "source",
  "amount",
  "promisedFor"
FROM "PromiseToPay"
WHERE "source" = 'VOICE'
ORDER BY "createdAt" DESC
LIMIT 3;
