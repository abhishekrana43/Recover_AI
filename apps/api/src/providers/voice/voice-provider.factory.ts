import {
  mockVoiceProvider,
} from "./mock-voice.provider.js";

import {
  HttpVoiceProvider,
} from "./http-voice.provider.js";

import {
  sarvamVoiceProvider,
} from "./sarvam-voice.provider.js";

import type {
  VoiceProvider,
} from "./voice-provider.types.js";

import {
  voiceConfig,
} from "../../config/voice.js";

export function getVoiceProvider(): VoiceProvider {
  switch (
    voiceConfig.provider.toUpperCase()
  ) {
    case "MOCK":
      return mockVoiceProvider;

    case "HTTP":
      return new HttpVoiceProvider();

    case "SARVAM":
      return sarvamVoiceProvider;

    default:
      throw new Error(
        `Unsupported voice provider: ${voiceConfig.provider}`
      );
  }
}