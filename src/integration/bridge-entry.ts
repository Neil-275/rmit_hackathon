// Bootstrap consumes the UI contract; adapters must be configured explicitly.
import { CONTRACT_VERSION } from "../contracts/api";
import { createVoiceVaultLive, type LiveOptions } from "./browser-runtime";
import { createVoiceVaultUIRuntime } from "./ui-runtime";

const g = globalThis as Record<string, unknown>;

export function createVoiceVaultLiveRuntime() {
  const options = g.VoiceVaultLiveConfig as Partial<LiveOptions> | undefined;
  if (!options?.auth || !options.crypto
      || typeof options.auth.init !== "function" || typeof options.auth.getToken !== "function"
      || typeof options.auth.session !== "function" || typeof options.auth.login !== "function"
      || typeof options.auth.logout !== "function"
      || typeof options.crypto.encryptIdentity !== "function" || typeof options.crypto.decryptIdentity !== "function") {
    throw new Error("POLICY_UNAVAILABLE");
  }
  return createVoiceVaultUIRuntime(createVoiceVaultLive({ ...options, apiBase: options.apiBase ?? "/api/v1" } as LiveOptions));
}

g.createVoiceVaultLiveRuntime = createVoiceVaultLiveRuntime;
g.VoiceVaultLiveInfo = Object.freeze({ contractVersion: CONTRACT_VERSION });
