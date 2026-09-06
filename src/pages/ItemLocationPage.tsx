import { useEffect, useRef, useState } from "react";
import API from "../services/api";
import FloatingLabelInput from "../components/FloatingLabelInput";
import GenericAutoComplete from "../components/GenericAutoComplete";
import type { AutoCompleteItem, ItemDetails } from "../types/item";

interface ItemLocationPageProps {
  onLogout: () => void;
}

type Message = { type: "success" | "error"; text: string } | null;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const value = error as { response?: { data?: { error?: string } }; message?: string };
    return value.response?.data?.error || value.message || fallback;
  }
  return fallback;
};

export default function ItemLocationPage({ onLogout }: ItemLocationPageProps) {
  const [itemQuery, setItemQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemDetails | null>(null);
  const [rackNumber, setRackNumber] = useState("");
  const [loadingItem, setLoadingItem] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const [autoCompleteMode, setAutoCompleteMode] = useState<"live" | "onCondition">(
    () =>
      (localStorage.getItem("autoCompleteMode") as "live" | "onCondition") ??
      "live",
  );

  const handleModeChange = (newMode: "live" | "onCondition") => {
    setAutoCompleteMode(newMode);
    localStorage.setItem("autoCompleteMode", newMode);
  };

  const handleModeToggle = () => {
    const nextMode = autoCompleteMode === "live" ? "onCondition" : "live";
    handleModeChange(nextMode);

    // Keep the search field ready for the next action after changing mode.
    window.setTimeout(() => {
      itemSearchRef.current?.focus();
    }, 0);
  };

  const itemSearchRef = useRef<HTMLInputElement>(null);
  const rackNumberRef = useRef<HTMLInputElement>(null);

  // Focus Rack No. only after React has rendered the selected item's detail fields.
  useEffect(() => {
    if (!selectedItem) return;

    const timer = window.setTimeout(() => {
      const input = rackNumberRef.current;
      if (!input) return;

      input.focus();
      input.select();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [selectedItem?.id]);

  const focusAndSelectItemName = () => {
    window.setTimeout(() => {
      const input = itemSearchRef.current;
      if (!input) return;
      input.focus();
      input.select();
    }, 0);
  };

  const handleCancel = () => {
    if (selectedItem) {
      setRackNumber(selectedItem.RackNumber ?? "");
    }
    setMessage(null);
    focusAndSelectItemName();
  };

  const handleItemSelect = async (item: AutoCompleteItem) => {
    try {
      setLoadingItem(true);
      setMessage(null);
      const response = await API.get<ItemDetails>(`/itemdetail/${item.id}`);
      const details = response.data;
      setSelectedItem(details);
      setRackNumber(details.RackNumber ?? "");
    } catch (error) {
      setSelectedItem(null);
      setRackNumber("");
      setMessage({ type: "error", text: getErrorMessage(error, "Unable to load item details.") });
    } finally {
      setLoadingItem(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedItem) return;
    try {
      setSaving(true);
      setMessage(null);
      await API.put(`/item/${selectedItem.id}`, {
        RackNumber: rackNumber.trim(),
      });
      setSelectedItem((current) =>
        current ? { ...current, RackNumber: rackNumber.trim() } : current,
      );
      setRackNumber(rackNumber.trim());
      setMessage({ type: "success", text: "Location / Rack No. updated successfully." });
      focusAndSelectItemName();
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error, "Unable to update Rack No.") });
    } finally {
      setSaving(false);
    }
  };

  const hasChange = !!selectedItem && rackNumber.trim() !== (selectedItem.RackNumber ?? "").trim();

  const readOnlyClass =
    "w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2.5 text-gray-700 shadow-sm disabled:cursor-default disabled:opacity-100";
  const editableClass =
    "w-full rounded-md border border-blue-400 bg-white px-3 py-2.5 font-semibold text-gray-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200";

  return (
    <main className="min-h-dvh bg-gray-100 text-gray-800">
      <header className="sticky top-0 z-30 border-b border-blue-200 bg-blue-50/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div>
            <h1 className="text-lg font-bold text-blue-900">PharmaSys</h1>
            <p className="text-xs font-medium text-blue-700">Item Location</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="min-h-10 rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4 sm:py-5">
        <section className="rounded-xl border border-blue-200 bg-white p-4 shadow-md sm:p-5">
          <div className="mb-6">
            <fieldset className="min-w-0 rounded-lg border-2 border-blue-400 bg-white px-2 pb-1 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
              <legend className="ml-1 px-1 text-sm font-medium text-blue-600">
                <span>Search Item</span>
                <button
                  type="button"
                  onClick={handleModeToggle}
                  className="ml-2 rounded px-1 font-bold text-blue-700 underline decoration-dotted underline-offset-2 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  title="Tap to switch autocomplete mode"
                  aria-label={`Autocomplete mode: ${
                    autoCompleteMode === "live" ? "Live" : "Enter key"
                  }. Tap to switch mode.`}
                >
                  [{autoCompleteMode === "live" ? " Live " : " Enter key "}]
                </button>
              </legend>

              <GenericAutoComplete
                ref={itemSearchRef}
                searchQuery={itemQuery}
                setSearchQuery={(value) => {
                  setItemQuery(value);
                  if (!value.trim()) {
                    setSelectedItem(null);
                    setRackNumber("");
                    setMessage(null);
                  }
                }}
                endpoint="/item/autocomplete"
                topLabel="Search Item"
                myplacehoder="Search..."
                minChars={3}
                minWords={2}
                mode={autoCompleteMode}
                setMode={handleModeChange}
                onSelect={handleItemSelect}
                listWidth="w-full"
                renderInPortal
                portalZIndex={1000}
                secondaryLabels={["label2"]}
                showLabel5={false}
                hideFloatingLabel
                inputClassName="w-full border-0 bg-transparent px-2 py-2 text-gray-900 shadow-none outline-none focus:border-0 focus:ring-0"
              />
            </fieldset>
          </div>

          {loadingItem && (
            <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
              Loading item details...
            </div>
          )}

          {selectedItem ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FloatingLabelInput
                    id="itemName"
                    label="Item Name"
                    value={selectedItem.ItemName ?? ""}
                    onChange={() => {}}
                    disabled
                    className={readOnlyClass}
                    labelBgClassName="bg-gray-100"
                  />
                </div>

                <FloatingLabelInput
                  id="packing"
                  label="Packing"
                  value={selectedItem.Packing ?? ""}
                  onChange={() => {}}
                  disabled
                  className={readOnlyClass}
                  labelBgClassName="bg-gray-100"
                />

                <FloatingLabelInput
                  id="boxPack"
                  label="Box Packing"
                  value={selectedItem.BoxPack ?? ""}
                  onChange={() => {}}
                  disabled
                  className={readOnlyClass}
                  labelBgClassName="bg-gray-100"
                />

                <div className="sm:col-span-2">
                  <FloatingLabelInput
                    id="companyName"
                    label="Company Name"
                    value={selectedItem.CompName ?? ""}
                    onChange={() => {}}
                    disabled
                    className={readOnlyClass}
                    labelBgClassName="bg-gray-100"
                  />
                </div>

                <FloatingLabelInput
                  id="companyShort"
                  label="Company Short"
                  value={selectedItem.CompShort ?? ""}
                  onChange={() => {}}
                  disabled
                  className={readOnlyClass}
                  labelBgClassName="bg-gray-100"
                />

                <FloatingLabelInput
                  ref={rackNumberRef}
                  id="rackNumber"
                  label="Location / Rack No."
                  value={rackNumber}
                  maxLength={15}
                  onChange={(e) => {
                    setRackNumber(e.target.value);
                    setMessage(null);
                  }}
                  className={editableClass}
                  labelBgClassName="bg-white"
                />
              </div>

              {message && (
                <div
                  role="status"
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    message.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-blue-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="min-h-11 rounded-md border border-gray-300 bg-white px-5 py-2.5 font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={saving || !hasChange}
                  className="min-h-11 rounded-md bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Updating..." : "Update"}
                </button>
              </div>
            </div>
          ) : (
            !loadingItem && (
              <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/50 px-4 py-10 text-center text-sm text-gray-600">
                Search and select an item to view its details and update the rack location.
              </div>
            )
          )}
        </section>
      </div>
    </main>
  );
}
