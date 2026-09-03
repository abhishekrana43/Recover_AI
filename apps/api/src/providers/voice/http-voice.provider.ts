import type {
  VoiceCallInput,
  VoiceCallResult,
  VoiceProvider,
  VoiceCallStatus,
} from "./voice-provider.types.js";

import { voiceConfig } from "../../config/voice.js";

function normalizeVoiceCallStatus(
  value: unknown
): VoiceCallStatus | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  switch (value.toUpperCase()) {
    case "QUEUED":
      return "QUEUED";

    case "RINGING":
      return "RINGING";

    case "IN_PROGRESS":
      return "IN_PROGRESS";

    case "COMPLETED":
      return "COMPLETED";

    case "FAILED":
      return "FAILED";

    default:
      return undefined;
  }
}

// function requireSarvamConfig() {
//   const sarvam = voiceConfig.sarvam;

//   if (!sarvam.apiKey) {
//     throw new Error(
//       "SARVAM_API_KEY is not configured"
//     );
//   }

//   if (!sarvam.orgId) {
//     throw new Error(
//       "SARVAM_ORG_ID is not configured"
//     );
//   }

//   if (!sarvam.workspaceId) {
//     throw new Error(
//       "SARVAM_WORKSPACE_ID is not configured"
//     );
//   }

//   if (!sarvam.appId) {
//     throw new Error(
//       "SARVAM_APP_ID is not configured"
//     );
//   }

//   if (!sarvam.connectionId) {
//     throw new Error(
//       "SARVAM_CONNECTION_ID is not configured"
//     );
//   }

//   if (!sarvam.agentPhoneNumber) {
//     throw new Error(
//       "SARVAM_AGENT_PHONE_NUMBER is not configured"
//     );
//   }

//   if (!sarvam.webhookUrl) {
//     throw new Error(
//       "SARVAM_WEBHOOK_URL is not configured"
//     );
//   }

//   return sarvam;
// }

function requireSarvamConfig(): {
  apiKey: string;
  orgId: string;
  workspaceId: string;
  appId: string;
  appVersion: number;
  connectionId: string;
  agentPhoneNumber: string;
  webhookUrl: string;
} {
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
    agentPhoneNumber:
      sarvam.agentPhoneNumber,
    webhookUrl: sarvam.webhookUrl,
  };
}

export class HttpVoiceProvider
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
        `${encodeURIComponent(sarvam.workspaceId)}` +
        `/outbounds`;

      const amountDue =
        `${input.amount / 100} ${input.currency}`;

      const response = await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "X-API-Key":
            sarvam.apiKey,
        },

        body: JSON.stringify({
          app_config: {
            app_id:
              sarvam.appId,

            app_version:
              sarvam.appVersion,

            app_type:
              "agent",

            connection_config: {
              connection_id:
                sarvam.connectionId,

              agent_phone_number:
                sarvam.agentPhoneNumber,
            },

            agent_variables: {
              amount_due:
                amountDue,

              call_summary:
                "",

              customer_name:
                input.customerName,

              payment_status:
                "FAILED",

              promised_payment_date:
                "",

              user_name:
                input.customerName,
            },

            app_overrides: {
              initial_bot_message:
                `Namaste ${input.customerName}, aapka recent payment complete nahi ho paya tha.`,

              // initial_state_name:
              //   undefined,
            },
          },

          user_config: {
            user_phone_number:
              input.phoneNumber,
          },

          webhook_config: {
            url:
              sarvam.webhookUrl,

            metadata: {
              recovery_case_id:
                input.recoveryCaseId,
            },
          },
        }),
      });

      const data: unknown =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        const errorResult =
          typeof data === "object" &&
          data !== null
            ? (
                data as Record<
                  string,
                  unknown
                >
              )
            : undefined;

        return {
          success: false,
          provider: "SARVAM",

          error:
            `Sarvam outbound request failed with status ${response.status}`,

          ...(errorResult !== undefined
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
          ? (
              data as Record<
                string,
                unknown
              >
            )
          : {};

      const providerCallId =
        typeof result.id === "string"
          ? result.id
          : typeof result.call_id ===
              "string"
            ? result.call_id
            : typeof result.outbound_id ===
                "string"
              ? result.outbound_id
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

      const status =
        normalizeVoiceCallStatus(
          result.status
        );

      return {
        success: true,
        provider: "SARVAM",
        providerCallId,

        ...(status !== undefined
          ? { status }
          : {
              status: "QUEUED",
            }),

        result,
      };
    } catch (error) {
      return {
        success: false,
        provider: "SARVAM",

        error:
          error instanceof Error
            ? error.message
            : "Sarvam voice request failed",
      };
    }
  }

  async getCallStatus(
    providerCallId: string
  ): Promise<VoiceCallResult> {
    /*
     * Sarvam's outbound API flow is webhook-driven.
     * Call status is therefore expected to be
     * updated through the webhook integration.
     *
     * We deliberately don't invent a status endpoint
     * that wasn't present in the API contract you provided.
     */
    return {
      success: true,
      provider: "SARVAM",
      providerCallId,
      status: "QUEUED",
      result: {
        message:
          "Call status is updated through Sarvam webhook events.",
      },
    };
  }
}