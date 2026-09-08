import { useEffect, useState } from "react";
import AppTabs, { type MobileTab } from "../components/AppTabs";
import ItemLocationPage from "./ItemLocationPage";
import PurchasesPage from "./PurchasesPage";
import CompaniesPage from "./CompaniesPage";
import CustomersPage from "./CustomersPage";
import { ACTIVE_TAB_KEY, getStoredValue, setStoredValue } from "../services/storage";

interface MobileTabsPageProps {
  onLogout: () => void;
}

type RackTarget = {
  id: number;
  itemName: string;
  requestKey: number;
  returnTo?: "companies" | "purchases";
  invoiceId?: number;
  tranId?: number;
};

type CompanyFocusTarget = {
  itemId: number;
  requestKey: number;
};

type PurchaseFocusTarget = {
  invoiceId: number;
  itemId: number;
  tranId: number;
  requestKey: number;
};

const isMobileTab = (value: string | null): value is MobileTab =>
  value === "rack" ||
  value === "purchases" ||
  value === "companies" ||
  value === "customers";

export default function MobileTabsPage({ onLogout }: MobileTabsPageProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>(
    () => {
      const storedTab = localStorage.getItem(ACTIVE_TAB_KEY);
      return isMobileTab(storedTab) ? storedTab : "rack";
    },
  );

  const [rackTarget, setRackTarget] = useState<RackTarget | null>(null);
  const [companyFocusTarget, setCompanyFocusTarget] =
    useState<CompanyFocusTarget | null>(null);
  const [purchaseFocusTarget, setPurchaseFocusTarget] =
    useState<PurchaseFocusTarget | null>(null);

  useEffect(() => {
    let disposed = false;

    void getStoredValue(ACTIVE_TAB_KEY).then((storedTab) => {
      if (!disposed && isMobileTab(storedTab)) setActiveTab(storedTab);
    });

    return () => {
      disposed = true;
    };
  }, []);

  const changeTab = (tab: MobileTab) => {
    setActiveTab(tab);
    void setStoredValue(ACTIVE_TAB_KEY, tab);
  };

  const openItemInRack = (item: { id: number; ItemName: string }) => {
    setRackTarget({
      id: item.id,
      itemName: item.ItemName,
      requestKey: Date.now(),
      returnTo: "companies",
    });

    changeTab("rack");
  };

  const openPurchaseItemInRack = (item: {
    id: number;
    ItemName: string;
    invoiceId: number;
    tranId: number;
  }) => {
    setRackTarget({
      id: item.id,
      itemName: item.ItemName,
      invoiceId: item.invoiceId,
      tranId: item.tranId,
      requestKey: Date.now(),
      returnTo: "purchases",
    });

    changeTab("rack");
  };

  /*
   * Called only when Update Rack was opened from a Company item row.
   * Return to the already-mounted CompaniesPage so its selected company,
   * search text, loaded items and scroll context are preserved.
   */
  const returnToSourceItem = () => {
    if (!rackTarget) return;

    if (rackTarget.returnTo === "purchases" && rackTarget.invoiceId) {
      setPurchaseFocusTarget({
        invoiceId: rackTarget.invoiceId,
        itemId: rackTarget.id,
        tranId: rackTarget.tranId ?? 0,
        requestKey: Date.now(),
      });

      setRackTarget(null);
      changeTab("purchases");
      return;
    }

    if (rackTarget.returnTo === "companies") {
      setCompanyFocusTarget({
        itemId: rackTarget.id,
        requestKey: Date.now(),
      });

      setRackTarget(null);
      changeTab("companies");
      return;
    }

    setRackTarget(null);
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
        Keep the pages mounted and hide inactive tabs. This is important:
        when an item is opened from Companies -> Update Rack, the selected
        company, item search and item-list state remain intact.
      */}
      <div className={activeTab === "rack" ? "block" : "hidden"} aria-hidden={activeTab !== "rack"}>
        <ItemLocationPage
          onLogout={onLogout}
          showHeader={false}
          rackTarget={rackTarget}
          onRackOperationComplete={returnToSourceItem}
        />
      </div>

      <div
        className={activeTab === "purchases" ? "block" : "hidden"}
        aria-hidden={activeTab !== "purchases"}
      >
        <PurchasesPage
          onEditRack={openPurchaseItemInRack}
          focusInvoiceId={purchaseFocusTarget?.invoiceId ?? null}
          focusItemId={purchaseFocusTarget?.itemId ?? null}
          focusTranId={purchaseFocusTarget?.tranId ?? null}
          focusRequestKey={purchaseFocusTarget?.requestKey ?? 0}
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
