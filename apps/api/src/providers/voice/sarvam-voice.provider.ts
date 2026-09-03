import type {
  VoiceCallInput,
  VoiceCallResult,
  VoiceProvider,
} from "./voice-provider.types.js";

import { voiceConfig } from "../../config/voice.js";

type SarvamResponse = Record<string, unknown>;

type SarvamConfig = {
  apiKey: string;
  orgId: string;
  workspaceId: string;
  appId: string;
  appVersion: number;
  connectionId: string;
  agentPhoneNumber: string;
  webhookUrl: string;
};

function requireSarvamConfig(): SarvamConfig {
  const sarvam = voiceConfig.sarvam;

  if (!sarvam.apiKey) {
    throw new Error(
      "SARVAM_API_KEY is not configured"
    );
  }

  if (!sarvam.orgId) {
    throw new Error(
      "SARVAM_ORG_ID is not configured"
    );
  }

  if (!sarvam.workspaceId) {
    throw new Error(
      "SARVAM_WORKSPACE_ID is not configured"
    );
  }

  if (!sarvam.appId) {
    throw new Error(
      "SARVAM_APP_ID is not configured"
    );
  }

  if (!sarvam.connectionId) {
    throw new Error(
      "SARVAM_CONNECTION_ID is not configured"
    );
  }

  if (!sarvam.agentPhoneNumber) {
    throw new Error(
      "SARVAM_AGENT_PHONE_NUMBER is not configured"
    );
  }

  if (!sarvam.webhookUrl) {
    throw new Error(
      "SARVAM_WEBHOOK_URL is not configured"
    );
  }

  return {
    apiKey: sarvam.apiKey,
    orgId: sarvam.orgId,
    workspaceId: sarvam.workspaceId,
    appId: sarvam.appId,
    appVersion: sarvam.appVersion,
    connectionId: sarvam.connectionId,
    agentPhoneNumber: sarvam.agentPhoneNumber,
    webhookUrl: sarvam.webhookUrl,
  };
}

export class SarvamVoiceProvider
  implements VoiceProvider
{
  async initiateCall(
    input: VoiceCallInput
  ): Promise<VoiceCallResult> {
    try {
      const sarvam =
        requireSarvamConfig();

      const url =
        `https://apps.sarvam.ai/api/outbounds/v1/orgs/` +
        `${encodeURIComponent(sarvam.orgId)}` +
        `/workspaces/` +
        `${encodeURIComponent(
          sarvam.workspaceId
        )}` +
        `/outbounds`;

      const amountDue =
        `${input.amount / 100} ${input.currency}`;

      const requestBody = {
        app_config: {
          app_id: sarvam.appId,
          app_version: sarvam.appVersion,
          app_type: "agent",

          connection_config: {
            connection_id:
              sarvam.connectionId,

            agent_phone_number:
              sarvam.agentPhoneNumber,
          },

          agent_variables: {
            amount_due: amountDue,

            call_summary: "",

            customer_name:
              input.customerName,

            payment_status: "FAILED",

            promised_payment_date: "",

            user_name:
              input.customerName,

            /*
             * Internal Recover-AI identifier.
             * The customer never sees this.
             */
            
          },

          app_overrides: {
            initial_bot_message:
              `Namaste ${input.customerName}, ` +
              `aapka recent payment complete ` +
              `nahi ho paya tha.`,
          },
        },

        user_config: {
          user_phone_number:
            input.phoneNumber,
        },

        webhook_config: {
          url: sarvam.webhookUrl,

          metadata: {
            recovery_case_id:
              input.recoveryCaseId,
          },
        },
      };

      console.log(
        "\n=== SARVAM REQUEST BODY ==="
      );

      console.dir(requestBody, {
        depth: null,
      });

      const response =
        await fetch(url, {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "X-API-Key":
              sarvam.apiKey,
          },

          body: JSON.stringify(
            requestBody
          ),
        });

      const data: unknown =
        await response
          .json()
          .catch(() => null);

      /*
       * Handle Sarvam API errors.
       */
      if (!response.ok) {
        const errorResult =
          typeof data === "object" &&
          data !== null
            ? (data as SarvamResponse)
            : undefined;

        console.error(
          "\n=== SARVAM OUTBOUND ERROR ==="
        );

        console.dir(
          {
            status:
              response.status,

            statusText:
              response.statusText,

            response:
              errorResult,
          },
          {
            depth: null,
          }
        );

        return {
          success: false,
          provider: "SARVAM",

          error:
            `Sarvam outbound request failed with status ${response.status}`,

          ...(errorResult
            ? {
                result:
                  errorResult,
              }
            : {}),
        };
      }

      const result =
        typeof data === "object" &&
        data !== null
          ? (data as SarvamResponse)
          : {};

      console.log(
        "\n=== SARVAM OUTBOUND RESPONSE ==="
      );

      console.dir(result, {
        depth: null,
      });

      /*
       * Sarvam outbound API returns:
       *
       * {
       *   attempt_id: "..."
       * }
       *
       * We use attempt_id as the provider call
       * identifier throughout Recover-AI.
       */
      const providerCallId =
        typeof result.attempt_id ===
        "string"
          ? result.attempt_id
          : undefined;

      if (!providerCallId) {
        return {
          success: false,
          provider: "SARVAM",

          error:
            "Sarvam response did not contain an outbound call ID",

          result,
        };
      }

      return {
        success: true,
        provider: "SARVAM",

        providerCallId,

        status: "QUEUED",

        result,
      };
    } catch (error) {
      console.error(
        "\n=== SARVAM NETWORK ERROR ==="
      );

      console.error(error);

      return {
        success: false,
        provider: "SARVAM",

        error:
          error instanceof Error
            ? error.message
            : "Sarvam outbound request failed",
      };
    }
  }

  async getCallStatus(
    providerCallId: string
  ): Promise<VoiceCallResult> {
    /*
     * Sarvam call lifecycle is currently handled
     * through webhook events.
     *
     * Do not invent a polling endpoint here.
     */
    return {
      success: true,
      provider: "SARVAM",
      providerCallId,
      status: "QUEUED",

      result: {
        message:
          "Sarvam call status is updated through webhook events.",
      },
    };
  }
}

export const sarvamVoiceProvider =
new SarvamVoiceProvider();