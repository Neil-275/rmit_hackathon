// Classic-script factory consumed by bootstrap. The host must supply an auth adapter explicitly.
import { CONTRACT_VERSION } from "../contracts/api";
import { createVoiceVaultLive, type AuthAdapter, type CryptoAdapter } from "./browser-runtime";
import { createVoiceVaultUIRuntime } from "./ui-runtime";

const g = globalThis as Record<string, unknown>;

export function createVoiceVaultLiveRuntime() {
  const config = g.VoiceVaultLiveConfig as { auth?: AuthAdapter; crypto?: CryptoAdapter; apiBase?: string; fetch?: typeof fetch } | undefined;
  const auth = config?.auth;
  if (!auth || ["init", "getToken", "login", "logout", "session"].some((key) => typeof auth[key as keyof AuthAdapter] !== "function")) {
    throw new Error("POLICY_UNAVAILABLE");
  }
  // No cryptographic operation is available unless the host supplies a complete crypto adapter.
  const unavailable = async (): Promise<never> => { throw new Error("POLICY_UNAVAILABLE"); };
  const supplied = config?.crypto;
  const crypto: CryptoAdapter = supplied && typeof supplied.encryptIdentity === "function" && typeof supplied.decryptIdentity === "function"
    ? supplied
    : { encryptIdentity: unavailable, decryptIdentity: unavailable };
  return createVoiceVaultUIRuntime(createVoiceVaultLive({ apiBase: config?.apiBase ?? "/api/v1", auth, crypto, ...(config?.fetch ? { fetch: config.fetch } : {}) }));
}

g.createVoiceVaultLiveRuntime = createVoiceVaultLiveRuntime;
g.VoiceVaultLiveInfo = Object.freeze({ contractVersion: CONTRACT_VERSION });
