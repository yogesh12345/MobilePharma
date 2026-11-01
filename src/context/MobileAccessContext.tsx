import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MobileAccessContext, type AccessData } from "./mobileAccess";
import API, { setMobileCustomerId } from "../services/api";
import { isMobileAccessData, mobileAccessErrorMessage, mobileBackendUpdateMessage } from "./mobileAccessResponse";

export function MobileAccessProvider({ children }: { children: ReactNode }) {
 const mounted = useRef(true);
 const requestVersion = useRef(0);
 const [data, setData] = useState<AccessData | null>(null);
 const [selectedId, setSelectedId] = useState<number | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const reload = useCallback(async () => {
  const version = ++requestVersion.current;
  try {
   const response = await API.get<unknown>("/mobile/access");
   if (!mounted.current || version !== requestVersion.current) return;
   if (!isMobileAccessData(response.data)) {
    setData(null); setMobileCustomerId(null); setSelectedId(null); setError(mobileBackendUpdateMessage); return;
   }
   const accessData = response.data;
   setData(accessData); setError("");
   setSelectedId(current => {
    const next = accessData.customers.some(customer => customer.customerId === current) ? current : accessData.customers.length === 1 ? accessData.customers[0].customerId : null;
    setMobileCustomerId(next); return next;
   });
  } catch (error: unknown) { if (!mounted.current || version !== requestVersion.current) return; setData(null); setMobileCustomerId(null); setSelectedId(null); setError(mobileAccessErrorMessage(error)); }
  finally { if (mounted.current && version === requestVersion.current) setLoading(false); }
 }, []);
 useEffect(() => { mounted.current = true; void Promise.resolve().then(reload); const refresh = () => { if (document.visibilityState === "visible") void reload(); }; window.addEventListener("focus", refresh); return () => { mounted.current = false;window.removeEventListener("focus", refresh); }; }, [reload]);
 const selectCustomer = (id: number | null) => { setMobileCustomerId(id); setSelectedId(id); };
 const customer = data?.customers.find(customer => customer.customerId === selectedId) ?? null;
 const can = (permission: string) => {
  if (error || !data?.account.active) return false;
  if (data.account.kind === "PENDING") return permission === "catalog";
  if (!customer) return false;
  return customer.owner || customer.permissions.includes(permission) || (permission !== "profile" && customer.permissions.includes("admin"));
 };
 return <MobileAccessContext.Provider value={{ data, customer, loading, error, can, selectCustomer, reload }}>{children}</MobileAccessContext.Provider>;
}

