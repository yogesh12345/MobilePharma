import { useCallback, useEffect, useState } from "react";
import API from "../services/api";
type Member = { userId: number; username: string; name: string; email: string; whatsapp: string; permissions: string[]; owner: boolean; invited: boolean };
const labels: Record<string,string> = { catalog: "Companies and items", arrivals: "New arrivals and schemes", orders: "Place or update orders", invoices: "Invoices", outstanding: "Outstanding", credit_notes: "Create or update credit notes", admin: "Customer administrator (all customer tasks)" };
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-3";
const errorMessage = (error: unknown) => (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Unable to update organization users.";
export default function MobileTeam({ onBack }: { onBack: () => void }) {
 const [users,setUsers] = useState<Member[]>([]);
 const [editing,setEditing] = useState<Member | null>(null);
 const [channel,setChannel] = useState("email");
 const [contact,setContact] = useState("");
 const [name,setName] = useState("");
 const [permissions,setPermissions] = useState<string[]>(["catalog"]);
 const [error,setError] = useState("");
 const [notice,setNotice] = useState("");
 const [busy,setBusy] = useState(false);
 const load = useCallback(async () => { try { const { data } = await API.get("/mobile/team"); setUsers(data.users ?? []); } catch (error) { setError(errorMessage(error)); } }, []);
 useEffect(() => { void Promise.resolve().then(load); }, [load]);
 const save = async () => {
  setBusy(true);setError("");setNotice("");
  try { const payload = { channel,contact,name,permissions }; const { data } = editing ? await API.put(`/mobile/team/${editing.userId}`,payload) : await API.post("/mobile/team",payload);setNotice(data.message);setEditing(null);setContact("");setName("");setPermissions(["catalog"]);await load(); } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
 };
 const remove = async (user: Member) => {
  setBusy(true);setError("");setNotice("");
  try { await API.delete(`/mobile/team/${user.userId}`);setNotice("User removed.");if (editing?.userId === user.userId) setEditing(null);await load(); } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
 };
 const additional = users.filter(user => !user.owner).length;
 return <section className="mx-auto max-w-3xl space-y-4 px-4 py-5">
  <div className="flex items-center justify-between"><h1 className="text-xl font-bold">Organization users</h1><button className="text-blue-700 underline" onClick={onBack}>Back</button></div><p className="text-sm text-slate-600">{additional} of 4 additional users. New users register with their assigned email or WhatsApp number and verify their OTP.</p>
  {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}{notice && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{notice}</p>}
  <div className="space-y-2">{users.map(user => <article key={user.userId} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{user.name || user.username}{user.owner && " ? First owner"}</h2><p className="text-sm text-slate-600">{user.email || user.whatsapp}{user.invited && " ? Awaiting OTP registration"}</p><p className="mt-1 text-xs text-slate-500">{user.owner ? "All customer tasks" : user.permissions.map(permission => labels[permission]).join(", ") || "No tasks assigned"}</p></div>{!user.owner && <div className="flex gap-3"><button disabled={busy} className="text-blue-700 underline" onClick={() => { setEditing(user);setPermissions(user.permissions);setError(""); }}>Edit roles</button><button disabled={busy} className="text-red-700 underline" onClick={() => void remove(user)}>Remove</button></div>}</div></article>)}</div>
  <form className="space-y-4 rounded-xl border bg-white p-4" onSubmit={event => { event.preventDefault();void save(); }}><h2 className="font-bold">{editing ? `Edit roles: ${editing.name || editing.username}` : "Add a user"}</h2>
   {!editing && <><label className="block text-sm font-semibold">Full name<input className={`${input} mt-1`} maxLength={150} value={name} onChange={event => setName(event.target.value)} /></label><label className="block text-sm font-semibold">Contact type<select className={`${input} mt-1`} value={channel} onChange={event => setChannel(event.target.value)}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></label><label className="block text-sm font-semibold">Assigned contact<input className={`${input} mt-1`} required type={channel === "email" ? "email" : "tel"} value={contact} onChange={event => setContact(event.target.value)} /></label></>}
   <fieldset><legend className="mb-2 font-semibold">Allowed tasks</legend>{Object.entries(labels).map(([key,label]) => <label key={key} className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={permissions.includes(key)} onChange={event => setPermissions(current => event.target.checked ? [...current,key] : current.filter(value => value !== key))} />{label}</label>)}</fieldset>
   <div className="flex gap-3"><button className="rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={busy || (!editing && additional >= 4)}>{busy ? "Saving..." : editing ? "Save roles" : "Add user"}</button>{editing && <button type="button" className="rounded border px-4 py-2" onClick={() => { setEditing(null);setPermissions(["catalog"]); }}>Cancel</button>}</div>
  </form>
 </section>;
}
