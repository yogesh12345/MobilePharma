import { useState } from "react";
import AppTabs, { type MobileTab } from "../components/AppTabs";
import ItemLocationPage from "./ItemLocationPage";
import CompaniesPage from "./CompaniesPage";
import CustomersPage from "./CustomersPage";

interface MobileTabsPageProps {
  onLogout: () => void;
}

type RackTarget = {
  id: number;
  itemName: string;
  requestKey: number;
};

type CompanyFocusTarget = {
  itemId: number;
  requestKey: number;
};

export default function MobileTabsPage({ onLogout }: MobileTabsPageProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>(
    () => (localStorage.getItem("mobileActiveTab") as MobileTab) || "rack",
  );

  const [rackTarget, setRackTarget] = useState<RackTarget | null>(null);
  const [companyFocusTarget, setCompanyFocusTarget] =
    useState<CompanyFocusTarget | null>(null);

  const changeTab = (tab: MobileTab) => {
    setActiveTab(tab);
    localStorage.setItem("mobileActiveTab", tab);
  };

  const openItemInRack = (item: { id: number; ItemName: string }) => {
    setRackTarget({
      id: item.id,
      itemName: item.ItemName,
      requestKey: Date.now(),
    });

    changeTab("rack");
  };

  /*
   * Called only when Update Rack was opened from a Company item row.
   * Return to the already-mounted CompaniesPage so its selected company,
   * search text, loaded items and scroll context are preserved.
   */
  const returnToCompanyItem = () => {
    if (!rackTarget) return;

    setCompanyFocusTarget({
      itemId: rackTarget.id,
      requestKey: Date.now(),
    });

    setRackTarget(null);
    changeTab("companies");
  };

  return (
    <main className="min-h-dvh bg-gray-100 text-gray-800">
      <header className="sticky top-0 z-30 border-b border-blue-200 bg-blue-50/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-[61px] w-full max-w-3xl items-center justify-between gap-3 px-3 py-2 sm:px-4">
          <div>
            <h1 className="text-lg font-bold text-blue-900">PharmaSys</h1>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <AppTabs activeTab={activeTab} onChange={changeTab} />

      {/*
        Keep the three pages mounted and hide inactive tabs. This is important:
        when an item is opened from Companies -> Update Rack, the selected
        company, item search and item-list state remain intact.
      */}
      <div className={activeTab === "rack" ? "block" : "hidden"} aria-hidden={activeTab !== "rack"}>
        <ItemLocationPage
          onLogout={onLogout}
          showHeader={false}
          rackTarget={rackTarget}
          onRackOperationComplete={returnToCompanyItem}
        />
      </div>

      <div
        className={activeTab === "companies" ? "block" : "hidden"}
        aria-hidden={activeTab !== "companies"}
      >
        <CompaniesPage
          onEditRack={openItemInRack}
          focusItemId={companyFocusTarget?.itemId ?? null}
          focusRequestKey={companyFocusTarget?.requestKey ?? 0}
        />
      </div>

      <div
        className={activeTab === "customers" ? "block" : "hidden"}
        aria-hidden={activeTab !== "customers"}
      >
        <CustomersPage />
      </div>
    </main>
  );
}
