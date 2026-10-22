// Entry cho bundle IIFE public/integration/runtime.generated.js (scripts/build-bridge.mjs).
// bootstrap.js gọi window.createVoiceVaultLive({ apiBase, auth, crypto }) trên HTTP(S).
import { CONTRACT_VERSION } from "../contracts/api";
import { createStubAuth, createStubCrypto, createVoiceVaultLive } from "./browser-runtime";

const g = globalThis as Record<string, unknown>;
g.createVoiceVaultLive = createVoiceVaultLive;
g.VoiceVaultLiveInfo = Object.freeze({ contractVersion: CONTRACT_VERSION });
// Stub chỉ cho chạy local trước khi có adapter Tide (sau spike G1). Không phải bảo mật thật.
g.VoiceVaultLiveStubs = Object.freeze({ createStubAuth, createStubCrypto });
