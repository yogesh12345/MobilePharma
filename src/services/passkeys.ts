import API from "./api";
import { getStoredValue, removeStoredValue, setStoredValue } from "./storage";

type Ceremony = { challengeId: string; options: { publicKey: Record<string, unknown> } };
export type SavedPasskey = { id: string; createdAt: string };
export const AUTO_PASSKEY_KEY = "pharmasys:auto-passkey";
export const autoPasskeyEnabled = async () => (await getStoredValue(AUTO_PASSKEY_KEY)) === "1";
export const setAutoPasskeyEnabled = async (enabled: boolean) => enabled ? setStoredValue(AUTO_PASSKEY_KEY, "1") : removeStoredValue(AUTO_PASSKEY_KEY);

const decode = (value: string): ArrayBuffer => {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return bytes.buffer;
};

const encode = (value: ArrayBuffer): string => {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const passkeysSupported = () =>
  window.isSecureContext && typeof PublicKeyCredential !== "undefined" && typeof navigator.credentials?.create === "function" && typeof navigator.credentials?.get === "function";

export async function passkeyServiceAvailable(): Promise<boolean> {
  if (!passkeysSupported()) return false;
  try {
    const { data } = await API.get<{ available: boolean }>("/mobile/passkeys/availability");
    return data.available === true;
  } catch { return false; }
}

const creationOptions = (raw: Record<string, unknown>): PublicKeyCredentialCreationOptions => {
  const options = raw as unknown as Omit<PublicKeyCredentialCreationOptions, "challenge" | "user" | "excludeCredentials"> & {
    challenge: string;
    user: Omit<PublicKeyCredentialUserEntity, "id"> & { id: string };
    excludeCredentials?: (Omit<PublicKeyCredentialDescriptor, "id"> & { id: string })[];
  };
  return {
    ...options,
    challenge: decode(options.challenge),
    user: { ...options.user, id: decode(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map(item => ({ ...item, id: decode(item.id) })),
  };
};

const requestOptions = (raw: Record<string, unknown>): PublicKeyCredentialRequestOptions => {
  const options = raw as unknown as Omit<PublicKeyCredentialRequestOptions, "challenge" | "allowCredentials"> & {
    challenge: string;
    allowCredentials?: (Omit<PublicKeyCredentialDescriptor, "id"> & { id: string })[];
  };
  return {
    ...options,
    challenge: decode(options.challenge),
    allowCredentials: options.allowCredentials?.map(item => ({ ...item, id: decode(item.id) })),
  };
};

export async function listPasskeys(): Promise<SavedPasskey[]> {
  const { data } = await API.get<{ passkeys: SavedPasskey[] }>("/mobile/passkeys");
  return data.passkeys;
}

export async function registerPasskey(password: string): Promise<void> {
  const { data } = await API.post<Ceremony>("/mobile/passkeys/register/options", { password });
  const credential = await navigator.credentials.create({ publicKey: creationOptions(data.options.publicKey) }) as PublicKeyCredential | null;
  if (!credential) throw new Error("Device verification was cancelled.");
  const response = credential.response as AuthenticatorAttestationResponse;
  await API.post(`/mobile/passkeys/register/verify?challengeId=${encodeURIComponent(data.challengeId)}`, {
    id: credential.id,
    rawId: encode(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: encode(response.clientDataJSON),
      attestationObject: encode(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  });
}

export async function signInWithPasskey(): Promise<{ token: string; username: string }> {
  const { data } = await API.post<Ceremony>("/mobile/passkeys/login/options");
  const credential = await navigator.credentials.get({ publicKey: requestOptions(data.options.publicKey) }) as PublicKeyCredential | null;
  if (!credential) throw new Error("Device verification was cancelled.");
  const response = credential.response as AuthenticatorAssertionResponse;
  const result = await API.post<{ token: string; username: string }>(`/mobile/passkeys/login/verify?challengeId=${encodeURIComponent(data.challengeId)}`, {
    id: credential.id,
    rawId: encode(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: encode(response.clientDataJSON),
      authenticatorData: encode(response.authenticatorData),
      signature: encode(response.signature),
      userHandle: response.userHandle ? encode(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  });
  return result.data;
}

export async function removePasskey(id: string): Promise<void> {
  await API.delete(`/mobile/passkeys/${encodeURIComponent(id)}`);
}
