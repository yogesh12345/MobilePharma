import { useMemo, useState } from "react";
import AppLauncher from "../components/AppLauncher";
import {
  MOBILE_MODULES,
  type MobileModule,
} from "../components/mobileModules";
import { usePermissions } from "../context/PermissionContext";
import ItemLocationPage from "./ItemLocationPage";
import PurchasesPage from "./PurchasesPage";
import CompaniesPage from "./CompaniesPage";
import CustomersPage from "./CustomersPage";

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

const MODULE_PERMISSIONS: Record<
  MobileModule,
  { resource: string; action: string }
> = {
  rack: { resource: "mobile.rack", action: "view" },
  purchases: { resource: "mobile.purchase", action: "view" },
  companies: { resource: "mobile.company", action: "view" },
  customers: { resource: "mobile.customer", action: "view" },
};

function HomeIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 11 8-7 8 7" />
      <path d="M6.5 10.5V20h11v-9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 6H6.5A1.5 1.5 0 0 0 5 7.5v9A1.5 1.5 0 0 0 6.5 18H10" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </svg>
  );
}

export default function MobileTabsPage({ onLogout }: MobileTabsPageProps) {
  const { canAccess, loading: permissionsLoading } = usePermissions();
  const [activeModule, setActiveModule] = useState<MobileModule | null>(null);

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
  const allowedModules = useMemo(
    () =>
      MOBILE_MODULES.filter((module) => {
        if (!module.visible) return false;
        if (module.key === "rack") return canOpenRack;

        const permission = MODULE_PERMISSIONS[module.key];
        return canAccess(permission.resource, permission.action);
      }),
    [canAccess, canOpenRack],
  );
  const hasModuleAccess = (module: MobileModule) =>
    allowedModules.some((allowed) => allowed.key === module && allowed.enabled);
  const selectedModule =
    activeModule &&
    (hasModuleAccess(activeModule) || (activeModule === "rack" && rackTarget))
      ? activeModule
      : null;

  const openModule = (module: MobileModule) => {
    if (!hasModuleAccess(module)) return;
    setActiveModule(module);
  };

  const openItemInRack = (item: { id: number; ItemName: string }) => {
    if (!canUpdateRack) return;

    setRackTarget({
      id: item.id,
      itemName: item.ItemName,
      requestKey: Date.now(),
      returnTo: "companies",
    });

    openModule("rack");
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

    setActiveModule("rack");
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
      openModule("purchases");
      return;
    }

    if (rackTarget.returnTo === "companies") {
      setCompanyFocusTarget({
        itemId: rackTarget.id,
        requestKey: Date.now(),
      });

      setRackTarget(null);
      openModule("companies");
      return;
    }

    setRackTarget(null);
  };

  return (
    <main className="min-h-dvh bg-gray-100 pb-20 text-gray-800">
      <header className="sticky top-0 z-30 border-b border-blue-200 bg-blue-50/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-[61px] w-full max-w-3xl items-center justify-between gap-3 px-3 py-2 sm:px-4">
          <div>
            <h1 className="text-lg font-bold text-blue-900">PharmaSys</h1>
          </div>

          {selectedModule && (
            <div className="truncate text-sm font-bold text-blue-900">
              {
                MOBILE_MODULES.find((module) => module.key === selectedModule)
                  ?.label
              }
            </div>
          )}
        </div>
      </header>

      {permissionsLoading ? (
        <div className="mx-auto w-full max-w-3xl px-3 py-4 text-sm font-semibold text-gray-600">
          Loading permissions...
        </div>
      ) : allowedModules.length === 0 ? (
        <div className="mx-auto w-full max-w-3xl px-3 py-10 text-center text-sm font-semibold text-red-700">
          You do not have permission to use MobilePharma.
        </div>
      ) : !selectedModule ? (
        <AppLauncher modules={allowedModules} onOpen={openModule} />
      ) : (
        <>
          {(hasModuleAccess("rack") || rackTarget) && (
            <div
              className={selectedModule === "rack" ? "block" : "hidden"}
              aria-hidden={selectedModule !== "rack"}
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

          {hasModuleAccess("purchases") && (
            <div
              className={selectedModule === "purchases" ? "block" : "hidden"}
              aria-hidden={selectedModule !== "purchases"}
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

          {hasModuleAccess("companies") && (
            <div
              className={selectedModule === "companies" ? "block" : "hidden"}
              aria-hidden={selectedModule !== "companies"}
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

          {hasModuleAccess("customers") && (
            <div
              className={selectedModule === "customers" ? "block" : "hidden"}
              aria-hidden={selectedModule !== "customers"}
            >
              <CustomersPage canUpdateContact={canUpdateCustomerContact} />
            </div>
          )}
        </>
      )}

      {!permissionsLoading && allowedModules.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-200 bg-white/95 shadow-[0_-4px_14px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto grid min-h-16 w-full max-w-3xl grid-cols-2">
            <button
              type="button"
              onClick={() => setActiveModule(null)}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold transition ${
                selectedModule
                  ? "text-slate-700 hover:bg-slate-50"
                  : "bg-blue-50 text-blue-800"
              }`}
              aria-current={!selectedModule ? "page" : undefined}
            >
              <HomeIcon />
              <span>Home</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex flex-col items-center justify-center gap-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
            >
              <LogoutIcon />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      )}
    </main>
  );
}
