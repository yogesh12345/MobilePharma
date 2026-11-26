import { useEffect, useState } from "react";
import { listPasskeys, passkeyServiceAvailable, passkeysSupported, registerPasskey, removePasskey, setAutoPasskeyEnabled, type SavedPasskey } from "../services/passkeys";

const errorText = (error: unknown) => {
  const response = error as { response?: { data?: { error?: string } }; message?: string; name?: string };
  if (response?.name === "NotAllowedError") return "Device verification was cancelled or timed out.";
  return response?.response?.data?.error || response?.message || "Device sign-in could not be updated.";
};

export default function PasskeySettings({ onBack }: { onBack: () => void }) {
  const [passkeys, setPasskeys] = useState<SavedPasskey[]>([]);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [serverAvailable, setServerAvailable] = useState(false);
  const supported = passkeysSupported();

  useEffect(() => {
    let active = true;
    void passkeyServiceAvailable().then(async available => {
      if (active) setServerAvailable(available);
      if (!available) return;
      const items = await listPasskeys();
      if (active) setPasskeys(items);
    })
      .catch(reason => { if (active) setError(errorText(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const enroll = async () => {
    if (!password) { setError("Enter your current password to enable device sign-in."); return; }
    try {
      setBusy(true); setError(""); setNotice("");
      await registerPasskey(password);
      await setAutoPasskeyEnabled(true);
      setPasskeys(await listPasskeys());
      setPassword("");
      setNotice("Passkey saved. On the sign-in page, choose Sign in with passkey when you want to use it.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try {
      setBusy(true); setError(""); setNotice("");
      await removePasskey(id);
      if (passkeys.length === 1) await setAutoPasskeyEnabled(false);
      setPasskeys(current => current.filter(item => item.id !== id));
      setNotice("Device sign-in was removed for this passkey.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  return <section className="mx-auto w-full max-w-lg space-y-5 p-4 text-slate-900">
    <div className="flex items-center justify-between gap-4"><h1 className="text-xl font-bold">Device sign-in</h1><button type="button" onClick={onBack} className="text-sm font-semibold text-blue-700">Back</button></div>
    <p className="text-sm text-slate-600">Use a passkey to sign in with your device’s face, iris, fingerprint, or screen lock. The method depends on your device. Your biometric data stays on the device.</p>
    {!supported && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Passkeys are not available in this browser or app build. Use a secure connection and a supported device.</p>}
    {supported && !loading && !serverAvailable && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Device sign-in is temporarily unavailable on the server. Please use your password to sign in and try again later.</p>}
    {loading && <p role="status" className="text-sm">Loading device sign-in settings...</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {!loading && serverAvailable && <>
      {passkeys.length > 0 ? <div className="space-y-2"><h2 className="font-semibold">Enabled passkeys</h2>{passkeys.map((item, index) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"><span className="text-sm">Passkey {index + 1} · Added {new Date(item.createdAt).toLocaleDateString("en-IN")}</span><button type="button" disabled={busy} onClick={() => void remove(item.id)} className="text-sm font-semibold text-red-700 disabled:opacity-50">Remove</button></div>)}</div> : <p className="text-sm font-medium">Device sign-in is not enabled for this account.</p>}
      {supported && <div className="space-y-3 rounded-xl border border-blue-200 bg-white p-4"><h2 className="font-semibold">{passkeys.length ? "Add another passkey" : "Enable device sign-in"}</h2><label className="block text-sm font-medium">Current password<input className="mt-1 w-full rounded-lg border border-slate-300 p-3" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label><button type="button" onClick={() => void enroll()} disabled={busy} className="rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Please wait..." : "Set up passkey"}</button></div>}
    </>}
  </section>;
}
