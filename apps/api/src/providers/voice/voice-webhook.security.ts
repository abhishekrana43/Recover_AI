import crypto from "crypto";

export function verifyVoiceWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const received = Buffer.from(signature, "utf8");
  const expected = Buffer.from(
    expectedSignature,
    "utf8"
  );

  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
}