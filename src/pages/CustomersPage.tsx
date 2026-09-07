import { useEffect, useState } from "react";
import API from "../services/api";
import FloatingLabelInput from "../components/FloatingLabelInput";

type Customer = {
  id: number;
  AreaCode: string;
  AreaName: string;
  CustomerName: string;
  AddressLine1: string;
  AddressLine2: string;
  AddressLine3: string;
  MobileNo: string;
  WhatsappNo: string;
  EmailID: string;
  CashSales: number;
  CreditSales: number;
};

type Area = {
  AreaCode: string;
  AreaName: string;
  CustomerCount: number;
  customers: Customer[];
};

const amount = (n: number) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const inputClass =
  "w-full rounded-md border border-blue-400 bg-white px-3 py-2.5 font-semibold text-gray-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200";

export default function CustomersPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [expandedArea, setExpandedArea] = useState<string>("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [mobile, setMobile] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMessage("");
      try {
        const res = await API.get("/mobile/customers");
        setAreas(Array.isArray(res.data?.areas) ? res.data.areas : []);
      } catch (e: any) {
        setMessage(e?.response?.data?.error || "Unable to load customers.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openCustomer = (c: Customer) => {
    setSelected(c);
    setMobile(c.MobileNo ?? "");
    setWhatsapp(c.WhatsappNo ?? "");
    setEmail(c.EmailID ?? "");
    setMessage("");
  };

  const hasChange =
    !!selected &&
    (mobile.trim() !== (selected.MobileNo ?? "").trim() ||
      whatsapp.trim() !== (selected.WhatsappNo ?? "").trim() ||
      email.trim() !== (selected.EmailID ?? "").trim());

  const saveCustomer = async () => {
    if (!selected || !hasChange) return;
    setSaving(true);
    setMessage("");
    try {
      await API.put(`/mobile/customers/${selected.id}/contact`, {
        MobileNo: mobile.trim(),
        WhatsappNo: whatsapp.trim(),
        EmailID: email.trim(),
      });

      const updated = {
        ...selected,
        MobileNo: mobile.trim(),
        WhatsappNo: whatsapp.trim(),
        EmailID: email.trim(),
      };
      setSelected(updated);
      setAreas((current) =>
        current.map((a) => ({
          ...a,
          customers: a.customers.map((c) => (c.id === updated.id ? updated : c)),
        })),
      );
      setMessage("Customer contact updated successfully.");
    } catch (e: any) {
      setMessage(e?.response?.data?.error || "Unable to update customer contact.");
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setMessage("");
          }}
          className="mb-3 text-sm font-semibold text-blue-700"
        >
          ← Customers
        </button>

        <section className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
          <h2 className="mb-5 text-base font-bold text-blue-900">{selected.CustomerName}</h2>

          <div className="grid grid-cols-1 gap-5">
            <FloatingLabelInput
              id="custMobile"
              label="Mobile No."
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                setMessage("");
              }}
              inputMode="tel"
              className={inputClass}
              labelBgClassName="bg-white"
            />
            <FloatingLabelInput
              id="custWhatsapp"
              label="WhatsApp No."
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(e.target.value);
                setMessage("");
              }}
              inputMode="tel"
              className={inputClass}
              labelBgClassName="bg-white"
            />
            <FloatingLabelInput
              id="custEmail"
              label="Email ID"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setMessage("");
              }}
              inputMode="email"
              type="email"
              className={inputClass}
              labelBgClassName="bg-white"
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setMobile(selected.MobileNo ?? "");
                setWhatsapp(selected.WhatsappNo ?? "");
                setEmail(selected.EmailID ?? "");
                setMessage("");
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!hasChange || saving}
              onClick={saveCustomer}
              className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Updating..." : "Update"}
            </button>
          </div>
          {message && <div className="mt-3 text-sm font-medium">{message}</div>}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4">
      {message && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {message}
        </div>
      )}
      {loading ? (
        <div className="rounded-lg bg-white p-4 text-sm shadow-sm">Loading customers...</div>
      ) : (
        <div className="space-y-3">
          {areas.map((area) => {
            const key = `${area.AreaCode}|${area.AreaName}`;
            const open = expandedArea === key;
            return (
              <section key={key} className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedArea(open ? "" : key)}
                  className="flex w-full items-center justify-between gap-3 bg-blue-50 px-3 py-3 text-left"
                >
                  <span className="font-bold text-blue-900">
                    {open ? "▼" : "▶"} {area.AreaName}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-blue-700">
                    {area.CustomerCount}
                  </span>
                </button>

                {open &&
                  area.customers.map((customer, customerIndex) => {
                    const address = [
                      customer.AddressLine1,
                      customer.AddressLine2,
                      customer.AddressLine3,
                    ].filter((x) => String(x || "").trim());

                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => openCustomer(customer)}
                        className={`block w-full border-t border-slate-200 px-3 py-3 text-left transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                          customerIndex % 2 === 0 ? "bg-white" : "bg-sky-50/70"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="font-semibold text-gray-900">{customer.CustomerName}</span>
                          <span className="flex flex-wrap gap-x-3 text-xs font-semibold">
                            {customer.CashSales !== 0 && (
                              <span className="text-emerald-700">Cash ₹{amount(customer.CashSales)}</span>
                            )}
                            {customer.CreditSales !== 0 && (
                              <span className="text-blue-700">Credit ₹{amount(customer.CreditSales)}</span>
                            )}
                          </span>
                        </div>

                        {address.length > 0 && (
                          <div className="mt-1 text-xs leading-4 text-gray-500">
                            {address.map((line, i) => (
                              <div key={i}>{line}</div>
                            ))}
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                          {customer.MobileNo && <span>Mob: {customer.MobileNo}</span>}
                          {customer.WhatsappNo && <span>WA: {customer.WhatsappNo}</span>}
                          {customer.EmailID && <span>{customer.EmailID}</span>}
                        </div>
                      </button>
                    );
                  })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
