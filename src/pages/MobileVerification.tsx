import { useState } from "react";
import type { FormEvent } from "react";
import API from "../services/api";
import { useMobileAccess } from "../context/mobileAccess";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900";
const errorMessage = (error: unknown) => (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Unable to complete verification.";
export default function MobileVerification({ mode, onBack, onComplete }: { mode: "register" | "recover" | "credentials"; onBack: () => void; onComplete?: () => void }) {
 const access = useMobileAccess();
 const [channel, setChannel] = useState(mode === "credentials" && !access.data?.user.email ? "whatsapp" : "email");
 const [contact, setContact] = useState(mode === "credentials" ? access.data?.user.email || access.data?.user.whatsapp || "" : "");
 const [challengeId, setChallengeId] = useState("");
 const [code, setCode] = useState("");
 const [username, setUsername] = useState(mode === "credentials" ? access.data?.user.username ?? "" : "");
 const [name, setName] = useState("");
 const [password, setPassword] = useState("");
 const [confirm, setConfirm] = useState("");
 const [newChannel, setNewChannel] = useState("email");
 const [newContact, setNewContact] = useState("");
 const [newContactChallengeId, setNewContactChallengeId] = useState("");
 const [newContactCode, setNewContactCode] = useState("");
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 const [notice, setNotice] = useState("");
 const request = async (newContactProof = false) => {
  setBusy(true); setError(""); setNotice("");
  try {
   const { data } = await API.post(mode === "credentials" ? "/mobile/account/otp" : "/mobile/auth/otp", { purpose: newContactProof ? "contact" : mode, channel: newContactProof ? newChannel : channel, contact: newContactProof ? newContact : contact }, { timeout:30000 });
   if (newContactProof) setNewContactChallengeId(data.challengeId); else setChallengeId(data.challengeId);
   setNotice("A verification code has been sent. It expires in 10 minutes.");
  } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
 };
 const submit = async (event: FormEvent) => {
  event.preventDefault(); setError(""); setNotice("");
  if (password !== confirm) { setError("Passwords do not match."); return; }
  if (newContact && !newContactChallengeId) { setError("Verify the new contact before saving."); return; }
  setBusy(true);
  try {
   const payload = { challengeId, code, username: username.trim(), name: name.trim(), password, newContactChallengeId, newContactCode };
   const response = mode === "credentials" ? await API.put("/mobile/account/credentials", payload) : await API.post(`/mobile/auth/${mode}`, payload);
   setNotice(response.data.message); setChallengeId(""); setCode(""); setPassword(""); setConfirm(""); onComplete?.();
  } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
 };
 return <section className="mx-auto max-w-lg space-y-4 p-5">
  <h1 className="text-xl font-bold">{mode === "register" ? "Register or activate an invitation" : mode === "recover" ? "Recover login credentials" : "Change login credentials"}</h1>
  <p className="text-sm text-slate-600">{mode === "register" ? "Verify your email or WhatsApp number. New accounts can browse companies while awaiting review." : "Verify a contact already registered to your account."}</p>
  {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}{notice && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{notice}</p>}
  <label className="block text-sm font-semibold">Verify using<select className={`${input} mt-1`} value={channel} disabled={busy} onChange={event => { setChannel(event.target.value); if (mode === "credentials") setContact(event.target.value === "email" ? access.data?.user.email ?? "" : access.data?.user.whatsapp ?? ""); setChallengeId(""); }}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></label>
  <label className="block text-sm font-semibold">{channel === "email" ? "Email address" : "WhatsApp number"}<input className={`${input} mt-1`} type={channel === "email" ? "email" : "tel"} value={contact} disabled={busy} onChange={event => { setContact(event.target.value); setChallengeId(""); }} /></label>
  <button className="rounded border border-blue-700 px-4 py-2 font-semibold text-blue-700 disabled:opacity-50" disabled={busy || !contact.trim()} onClick={() => void request()}>{busy ? "Please wait..." : "Send verification code"}</button>
  {challengeId && <form onSubmit={submit} className="space-y-4">
   <label className="block text-sm font-semibold">Verification code<input className={`${input} mt-1`} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} /></label>
   {mode === "register" && <label className="block text-sm font-semibold">Full name<input className={`${input} mt-1`} value={name} maxLength={150} onChange={event => setName(event.target.value)} /></label>}
   <label className="block text-sm font-semibold">{mode === "register" ? "Username" : "Username (optional)"}<input className={`${input} mt-1`} autoComplete="username" required={mode === "register"} pattern="[A-Za-z0-9._-]{3,40}" value={username} onChange={event => setUsername(event.target.value)} /></label>
   <label className="block text-sm font-semibold">{mode === "credentials" ? "New password (optional)" : "Password"}<input className={`${input} mt-1`} type="password" autoComplete="new-password" required={mode !== "credentials"} minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} /></label>
   <label className="block text-sm font-semibold">Confirm password<input className={`${input} mt-1`} type="password" autoComplete="new-password" required={Boolean(password)} value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
   {mode === "credentials" && <fieldset className="space-y-3 rounded border p-3"><legend className="px-1 font-semibold">Change a contact (optional)</legend><select aria-label="New contact type" className={input} value={newChannel} onChange={event => { setNewChannel(event.target.value); setNewContactChallengeId(""); }}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select><input className={input} aria-label="New contact" type={newChannel === "email" ? "email" : "tel"} value={newContact} onChange={event => { setNewContact(event.target.value); setNewContactChallengeId(""); }} /><button type="button" className="font-semibold text-blue-700 underline" disabled={busy || !newContact} onClick={() => void request(true)}>Send code to new contact</button>{newContactChallengeId && <input className={input} aria-label="New contact verification code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required value={newContactCode} onChange={event => setNewContactCode(event.target.value)} />}</fieldset>}
   <button className="w-full rounded bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={busy}>{busy ? "Saving..." : mode === "register" ? "Verify and register" : "Verify and save credentials"}</button>
  </form>}
  <button className="rounded border px-4 py-2" onClick={onBack}>Back to {mode === "credentials" ? "home" : "login"}</button>
 </section>;
}
