import { useEffect, useMemo, useState } from "react";
import AppTabs, { MOBILE_TABS, type MobileTab } from "../components/AppTabs";
import { usePermissions } from "../context/PermissionContext";
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

const TAB_PERMISSIONS: Record<MobileTab, { resource: string; action: string }> = {
  rack: { resource: "mobile.rack", action: "view" },
  purchases: { resource: "mobile.purchase", action: "view" },
  companies: { resource: "mobile.company", action: "view" },
  customers: { resource: "mobile.customer", action: "view" },
};

const isMobileTab = (value: string | null): value is MobileTab =>
  value === "rack" ||
  value === "purchases" ||
  value === "companies" ||
  value === "customers";

export default function MobileTabsPage({ onLogout }: MobileTabsPageProps) {
  const { canAccess, loading: permissionsLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState<MobileTab>(() => {
    const storedTab = localStorage.getItem(ACTIVE_TAB_KEY);
    return isMobileTab(storedTab) ? storedTab : "rack";
  });

  const [rackTarget, setRackTarget] = useState<RackTarget | null>(null);
  const [companyFocusTarget, setCompanyFocusTarget] =
    useState<CompanyFocusTarget | null>(null);
  const [purchaseFocusTarget, setPurchaseFocusTarget] =
    useState<PurchaseFocusTarget | null>(null);

  const canUpdateRack = canAccess("mobile.rack", "update");
  const canOpenRack = canAccess("mobile.rack", "view") || canUpdateRack;
  const canEditPurchase = canAccess("mobile.purchase", "edit");
  const canOpenRackFromPurchase = canUpdateRack || canEditPurchase;
  const canUpdateCompany = canAccess("mobile.company", "update");
  const canUpdateCustomerContact = canAccess(
    "mobile.customer",
    "update_contact",
  );
  const allowedTabs = useMemo(
    () =>
      MOBILE_TABS.filter((tab) => {
        if (tab.key === "rack") return canOpenRack;

        const permission = TAB_PERMISSIONS[tab.key];
        return canAccess(permission.resource, permission.action);
      }),
    [canAccess, canOpenRack],
  );
  const hasTabAccess = (tab: MobileTab) =>
    allowedTabs.some((allowed) => allowed.key === tab);

  useEffect(() => {
    let disposed = false;

    void getStoredValue(ACTIVE_TAB_KEY).then((storedTab) => {
      if (!disposed && isMobileTab(storedTab)) setActiveTab(storedTab);
    });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (permissionsLoading) return;
    const firstAllowed = allowedTabs[0]?.key;
    if (!firstAllowed) return;
    if (activeTab === "rack" && rackTarget) return;
    if (!hasTabAccess(activeTab)) {
      setActiveTab(firstAllowed);
      void setStoredValue(ACTIVE_TAB_KEY, firstAllowed);
    }
  }, [activeTab, allowedTabs, permissionsLoading, rackTarget]);

  const changeTab = (tab: MobileTab) => {
    if (!hasTabAccess(tab)) return;
    setActiveTab(tab);
    void setStoredValue(ACTIVE_TAB_KEY, tab);
  };

  const openItemInRack = (item: { id: number; ItemName: string }) => {
    if (!canUpdateRack) return;

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
    if (!canOpenRackFromPurchase) return;

    setRackTarget({
      id: item.id,
      itemName: item.ItemName,
      invoiceId: item.invoiceId,
      tranId: item.tranId,
      requestKey: Date.now(),
      returnTo: "purchases",
    });

    setActiveTab("rack");
  };

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

      {permissionsLoading ? (
        <div className="mx-auto w-full max-w-3xl px-3 py-4 text-sm font-semibold text-gray-600">
          Loading permissions...
        </div>
      ) : allowedTabs.length === 0 ? (
        <div className="mx-auto w-full max-w-3xl px-3 py-10 text-center text-sm font-semibold text-red-700">
          You do not have permission to use MobilePharma.
        </div>
      ) : (
        <>
          <AppTabs activeTab={activeTab} tabs={allowedTabs} onChange={changeTab} />

          {(hasTabAccess("rack") || rackTarget) && (
            <div
              className={activeTab === "rack" ? "block" : "hidden"}
              aria-hidden={activeTab !== "rack"}
            >
              <ItemLocationPage
                onLogout={onLogout}
                showHeader={false}
                rackTarget={rackTarget}
                canUpdateRack={
                  canUpdateRack ||
                  (rackTarget?.returnTo === "purchases" && canEditPurchase)
                }
                onRackOperationComplete={returnToSourceItem}
              />
            </div>
          )}

          {hasTabAccess("purchases") && (
            <div
              className={activeTab === "purchases" ? "block" : "hidden"}
              aria-hidden={activeTab !== "purchases"}
            >
              <PurchasesPage
                onEditRack={openPurchaseItemInRack}
                canUpdateRack={canOpenRackFromPurchase}
                focusInvoiceId={purchaseFocusTarget?.invoiceId ?? null}
                focusItemId={purchaseFocusTarget?.itemId ?? null}
                focusTranId={purchaseFocusTarget?.tranId ?? null}
                focusRequestKey={purchaseFocusTarget?.requestKey ?? 0}
              />
            </div>
          )}

          {hasTabAccess("companies") && (
            <div
              className={activeTab === "companies" ? "block" : "hidden"}
              aria-hidden={activeTab !== "companies"}
            >
              <CompaniesPage
                onEditRack={openItemInRack}
                canUpdateCompany={canUpdateCompany}
                canUpdateRack={canUpdateRack}
                focusItemId={companyFocusTarget?.itemId ?? null}
                focusRequestKey={companyFocusTarget?.requestKey ?? 0}
              />
            </div>
          )}

          {hasTabAccess("customers") && (
            <div
              className={activeTab === "customers" ? "block" : "hidden"}
              aria-hidden={activeTab !== "customers"}
            >
              <CustomersPage canUpdateContact={canUpdateCustomerContact} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
