// Classic-script factory consumed by bootstrap. The host must supply a real auth adapter.
import { CONTRACT_VERSION } from "../contracts/api";
import { createVoiceVaultLive, type AuthAdapter, type CryptoAdapter } from "./browser-runtime";
import { createVoiceVaultUIRuntime } from "./ui-runtime";

const g = globalThis as Record<string, unknown>;
g.createVoiceVaultLiveRuntime = () => {
  const config = g.VoiceVaultLiveConfig as { auth?: AuthAdapter } | undefined;
  const auth = config?.auth;
  if (!auth || ["init", "getToken", "login", "logout", "session"].some((key) => typeof auth[key as keyof AuthAdapter] !== "function")) {
    throw new Error("POLICY_UNAVAILABLE");
  }
  // No cryptographic operation is available until a Tide policy adapter is verified.
  const unavailable = async (): Promise<never> => { throw new Error("POLICY_UNAVAILABLE"); };
  const crypto: CryptoAdapter = { encryptIdentity: unavailable, decryptIdentity: unavailable };
  return createVoiceVaultUIRuntime(createVoiceVaultLive({ apiBase: "/api/v1", auth, crypto }));
};
g.VoiceVaultLiveInfo = Object.freeze({ contractVersion: CONTRACT_VERSION });
