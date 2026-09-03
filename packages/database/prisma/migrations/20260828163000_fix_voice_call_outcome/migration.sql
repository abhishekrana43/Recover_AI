-- Fix VoiceCall.outcome to use its dedicated enum.

ALTER TABLE "VoiceCall"
ALTER COLUMN "outcome"
TYPE "VoiceCallOutcome"
USING "outcome"::text::"VoiceCallOutcome";