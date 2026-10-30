import { useEffect, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import API from "../services/api";
import FloatingLabelInput from "../components/FloatingLabelInput";
import FloatingLabelShow from "../components/FloatingLabelShow";
import FloatingLabelSelect from "../components/FloatingLabelSelect";
import { emptyForm, profileFormFromResponse, profileSavePayload } from "./profileForm";
import type { ProfileForm } from "./profileForm";

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export default function Profile({ onBack, onUsernameChange, onProfileSaved, onCredentialsChanged }: { onBack: () => void; onUsernameChange?: (name: string) => void; onProfileSaved?: (profile: { status: string; customerId: number | null } & Record<string, unknown>) => void; onCredentialsChanged?: () => void }) {
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({});
  const [success, setSuccess] = useState("");
  const [status, setStatus] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [presentPassword, setPresentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    let active = true;
    API.get("/mobile/profile").then(({ data }) => {
      if (!active) return;
      setForm(profileFormFromResponse(data.profile, data.username, data.emailId));
      setStatus(data.profile?.status ?? "");
    }).catch((err) => {
      if (active) setError(err?.response?.data?.error ?? "Unable to load profile.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const set = (key: keyof ProfileForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const setCategory = (value: string) => {
    setForm((current) => ({ ...current, category: value }));
    setFieldErrors((current) => ({ ...current, category: undefined }));
  };

  const field = (key: keyof ProfileForm, label: string, options: { required?: boolean; type?: string; autoComplete?: string; pattern?: string; maxLength?: number; hint?: string } = {}) => (
    <div className="space-y-1.5 pt-2" key={key}>
      <FloatingLabelInput id={`profile-${key}`} label={`${label}${options.required ? " *" : ""}`} aria-invalid={Boolean(fieldErrors[key])} aria-describedby={fieldErrors[key] ? `${key}-error` : undefined} className={`${inputClass} ${fieldErrors[key] ? "border-red-500 focus:border-red-600 focus:ring-red-100" : ""}`} value={form[key]} onChange={set(key)} required={options.required} type={options.type ?? "text"} autoComplete={options.autoComplete} pattern={options.pattern} maxLength={options.maxLength} inputMode={key === "mobileNo" || key === "whatsAppNo" || key === "pin" ? "tel" : undefined} title={options.hint} />
      {fieldErrors[key] && <span id={`${key}-error`} className="block text-sm font-medium text-red-700">{fieldErrors[key]}</span>}
      {options.hint && <span className="block text-xs text-slate-500">{options.hint}</span>}
    </div>
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setFieldErrors({}); setSuccess(""); setSaving(true);
    if (!form.category) { setFieldErrors({ category: "Choose a category." }); setError("Choose a category."); setSaving(false); return; }
    try {
      const payload = profileSavePayload(form);
      const { data } = await API.put("/mobile/profile", payload);
      setForm(profileFormFromResponse(data.profile, data.username));
      setStatus(data.profile?.status ?? "");
      onUsernameChange?.(data.username);
      onProfileSaved?.(data.profile);
      setSuccess("Profile saved successfully.");
    } catch (err: unknown) {
      const response = err as { response?: { data?: { error?: string; fieldErrors?: Partial<Record<keyof ProfileForm, string>> } } };
      const errors = response.response?.data?.fieldErrors ?? {};
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      setError(first ? errors[first as keyof ProfileForm] ?? "Please correct the highlighted fields." : response.response?.data?.error ?? (err instanceof Error ? `Unable to save profile: ${err.message}` : "Unable to save profile. Please try again."));
      if (first) window.setTimeout(() => {
        const element = document.getElementById(`profile-${first}`);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        element?.focus({ preventScroll: true });
      }, 0);
    } finally { setSaving(false); }
  };

  const resetCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setResetError("");
    if (newPassword !== confirmPassword) { setResetError("New passwords do not match."); return; }
    setResetBusy(true);
    try {
      await API.put("/mobile/profile/credentials", { username: resetUsername.trim(), presentPassword, newPassword, confirmPassword });
      setResetOpen(false); setPresentPassword(""); setNewPassword(""); setConfirmPassword("");
      onCredentialsChanged?.();
    } catch (err: unknown) {
      const response = err as { response?: { data?: { error?: string } } };
      setResetError(response.response?.data?.error ?? "Unable to change credentials.");
    } finally { setResetBusy(false); }
  };

  return <section className="mx-auto w-full max-w-3xl px-3 py-5 sm:px-4">
    <div className="mb-5 flex items-start gap-3">
      <button type="button" onClick={onBack} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Back</button>
      <div><h2 className="text-xl font-bold text-slate-900">Customer profile</h2><p className="text-sm text-slate-600">Register the business or practice using this app.</p></div>
    </div>
    {loading ? <p className="text-sm text-slate-600">Loading profile...</p> : <form onSubmit={save} className="space-y-5">
      {status && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Registration status: <strong>{status}</strong>{status === "PENDING" && ". Awaiting customer activation or a unique GST match."}{status === "LINKED" && ". Your customer account is ready to use."}{status === "INACTIVE" && ". Contact your administrator to reactivate this profile."}</div>}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{success}</p>}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="font-bold text-slate-900">Business details</h3>
        {field("customerName", "Customer / organization name", { required: true, maxLength: 150 })}
        <div className="pt-2"><FloatingLabelSelect id="profile-category" label="Category *" value={form.category} onChange={setCategory} placeholder="Select category" options={["Retailer", "Hospital", "Doctor", "Dealer", "Subdealer"].map((category) => ({ value: category, label: category }))} className="min-h-12 rounded-xl border border-slate-300 bg-white text-slate-900" />{fieldErrors.category && <span className="block pt-1 text-sm font-medium text-red-700">{fieldErrors.category}</span>}</div>
        {field("addressLine1", "Address line 1", { required: true, maxLength: 200, autoComplete: "address-line1" })}
        {field("addressLine2", "Address line 2", { maxLength: 200, autoComplete: "address-line2" })}
        <div className="grid grid-cols-2 gap-4">{field("city", "City", { required: true, maxLength: 80, autoComplete: "address-level2" })}{field("district", "District", { required: true, maxLength: 80 })}{field("state", "State", { required: true, maxLength: 80, autoComplete: "address-level1" })}{field("country", "Country", { required: true, maxLength: 80, autoComplete: "country-name" })}</div>
        {field("pin", "PIN", { required: true, pattern: "[0-9]{6}", maxLength: 6, autoComplete: "postal-code", hint: "Six-digit postal code" })}
        <div className="grid gap-4 sm:grid-cols-2">{field("gstNo", "GST number", { maxLength: 15 })}{field("pan", "PAN", { maxLength: 10 })}</div>
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="font-bold text-slate-900">Contact and login</h3>
        {field("contactPerson", "Contact person", { required: true, maxLength: 120, autoComplete: "name" })}
        <div className="grid gap-4 sm:grid-cols-2">{field("mobileNo", "Mobile number", { required: true, type: "tel", maxLength: 20, autoComplete: "tel", hint: "10 digits; +91 and spaces are accepted." })}{field("whatsAppNo", "WhatsApp number", { type: "tel", maxLength: 20 })}</div>
        {field("emailId", "Email ID", { required: true, type: "email", maxLength: 150, autoComplete: "email" })}
        <div className="space-y-1.5 pt-2"><FloatingLabelShow id="profile-username" label="Login name" value={form.username} className={`${inputClass} bg-slate-100`} /><span className="block text-xs text-slate-500">Use Reset login credentials to change your login name or password.</span></div>
        <label className="block space-y-1.5"><span className="text-sm font-semibold text-slate-700">Remark</span><textarea className={inputClass} rows={3} maxLength={2000} value={form.remark} onChange={set("remark")} /></label>
      </div>
      <button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : status ? "Save profile" : "Register profile"}</button>
      <button type="button" onClick={() => { setResetUsername(form.username); setResetError(""); setResetOpen(true); }} className="w-full rounded-xl border border-blue-700 bg-white px-4 py-3 font-semibold text-blue-700">Reset login credentials</button>
    </form>}
    {resetOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={resetCredentials} role="dialog" aria-modal="true" aria-label="Reset login credentials" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-bold text-slate-900">Reset login credentials</h3><p className="text-sm text-slate-600">Enter your current password. You will sign in again after the change.</p><label className="block text-sm font-semibold">Login name<input className={inputClass} value={resetUsername} onChange={e => setResetUsername(e.target.value)} required pattern="[A-Za-z0-9._-]{3,40}" maxLength={40} /></label><label className="block text-sm font-semibold">Current password<input className={inputClass} type="password" autoComplete="current-password" value={presentPassword} onChange={e => setPresentPassword(e.target.value)} required /></label><label className="block text-sm font-semibold">New password<input className={inputClass} type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} maxLength={72} /></label><label className="block text-sm font-semibold">Confirm new password<input className={inputClass} type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></label>{resetError && <p role="alert" className="text-sm text-red-700">{resetError}</p>}<div className="flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2" onClick={() => setResetOpen(false)}>Cancel</button><button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={resetBusy}>{resetBusy ? "Saving..." : "Reset credentials"}</button></div></form></div>}
  </section>;
}
