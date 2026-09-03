import "dotenv/config";

const voiceProvider =
  process.env.VOICE_PROVIDER ?? "MOCK";

const voiceApiKey =
  process.env.VOICE_API_KEY;

const voiceWebhookSecret =
  process.env.VOICE_WEBHOOK_SECRET;

const voiceBaseUrl =
  process.env.VOICE_API_BASE_URL;

const sarvamApiKey =
  process.env.SARVAM_API_KEY;

const sarvamOrgId =
  process.env.SARVAM_ORG_ID;

const sarvamWorkspaceId =
  process.env.SARVAM_WORKSPACE_ID;

const sarvamAppId =
  process.env.SARVAM_APP_ID;

const sarvamAppVersion =
  Number(process.env.SARVAM_APP_VERSION ?? "1");

const sarvamConnectionId =
  process.env.SARVAM_CONNECTION_ID;

const sarvamAgentPhoneNumber =
  process.env.SARVAM_AGENT_PHONE_NUMBER;

const sarvamAgentId =
  process.env.SARVAM_AGENT_ID;

const sarvamCampaignId =
  process.env.SARVAM_CAMPAIGN_ID;

const sarvamWebhookUrl =
  process.env.SARVAM_WEBHOOK_URL;

export const voiceConfig = {
  provider: voiceProvider,

  apiKey: voiceApiKey,

  webhookSecret: voiceWebhookSecret,

  baseUrl: voiceBaseUrl,

  sarvam: {
    apiKey: sarvamApiKey,
    orgId: sarvamOrgId,
    workspaceId: sarvamWorkspaceId,
    appId: sarvamAppId,
    appVersion: sarvamAppVersion,
    connectionId: sarvamConnectionId,
    agentPhoneNumber:
      sarvamAgentPhoneNumber,
    agentId: sarvamAgentId,
    campaignId: sarvamCampaignId,
    webhookUrl: sarvamWebhookUrl,
  },
};