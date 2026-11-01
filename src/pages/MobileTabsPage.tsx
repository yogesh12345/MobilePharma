import { useEffect, useMemo, useRef, useState } from "react";
import AppLauncher from "../components/AppLauncher";
import {
  MOBILE_MODULES,
  type MobileModule,
} from "../components/mobileModules";
import { usePermissions } from "../context/PermissionContext";
import API from "../services/api";
import ItemLocationPage from "./ItemLocationPage";
import PurchasesPage from "./PurchasesPage";
import CompaniesPage from "./CompaniesPage";
import CustomersPage from "./CustomersPage";
import SalesOrderPage, { type CustomerUpdate } from "./SalesOrderPage";
import Profile from "./Profile";
import CustomerPortalPage from "./CustomerPortalPage";
import { customerIdentityFromLinkedCustomer, customerIdentityFromProfile, type CustomerIdentity } from "./profileForm";

interface MobileTabsPageProps {
  onLogout: () => void;
  initialUserName?: string;
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
  salesOrders: { resource: "mobile.salesOrder", action: "view" },
};

const displayUserName = (value: unknown) => {
  const name = String(value || "").trim();
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : "User";
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

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function MobileTabsPage({ onLogout, initialUserName }: MobileTabsPageProps) {
  const { canAccess, loading: permissionsLoading } = usePermissions();
  const [activeModule, setActiveModule] = useState<MobileModule | null>(null);
  const [salesOrderRoleAccess, setSalesOrderRoleAccess] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");
  const [customerPortalKey, setCustomerPortalKey] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState(() => displayUserName(initialUserName));
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [hasCustomerProfile, setHasCustomerProfile] = useState(false);
  const [customerIdentity, setCustomerIdentity] = useState<CustomerIdentity | null>(null);
  const [linkedCustomer, setLinkedCustomer] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [employeeLoaded, setEmployeeLoaded] = useState(false);

  const [rackTarget, setRackTarget] = useState<RackTarget | null>(null);
  const [companyFocusTarget, setCompanyFocusTarget] =
    useState<CompanyFocusTarget | null>(null);
  const [purchaseFocusTarget, setPurchaseFocusTarget] =
    useState<PurchaseFocusTarget | null>(null);
  const [customerFocusTarget, setCustomerFocusTarget] =
    useState<{ id: number; requestKey: number; customer?: CustomerUpdate } | null>(null);
  const [customerUpdate, setCustomerUpdate] = useState<CustomerUpdate | null>(null);
  const [customerReturnFocusKey, setCustomerReturnFocusKey] = useState(0);

  const canUpdateRack = canAccess("mobile.rack", "update");
  const canOpenRack = canAccess("mobile.rack", "view") || canUpdateRack;
  const canEditPurchase = canAccess("mobile.purchase", "edit");
  const canOpenRackFromPurchase = canUpdateRack || canEditPurchase;
  const canUpdateCompany = canAccess("mobile.company", "update");
  const canUpdateCustomerContact = canAccess(
    "mobile.customer",
    "update_contact",
  );

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    let disposed = false;
    const loadCustomer = async () => {
      try {
        const { data } = await API.get("/mobile/profile");
        if (disposed) return;
        const profile = data.profile as Record<string, unknown> | null;
        const linked = profile?.status === "LINKED" && Boolean(profile?.customerId);
        setHasCustomerProfile(Boolean(profile));
        setProfileStatus(String(profile?.status ?? ""));
        setCustomerIdentity(customerIdentityFromProfile(profile));
        setLinkedCustomer(linked);

        if (linked) {
          try {
            const response = await API.get("/mobile/customer-portal/customer");
            if (!disposed) {
              setCustomerIdentity(customerIdentityFromLinkedCustomer(response.data?.customer, profile));
            }
          } catch {
            // The profile response can still supply customer identity.
          }
        }
      } catch {
        // Keep the portal available if profile data cannot be loaded.
      } finally {
        if (!disposed) setProfileLoaded(true);
      }
    };
    void loadCustomer();
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    let disposed = false;
    void API.get("/mobile/sales-orders/access")
      .then((res) => {
        if (!disposed) setSalesOrderRoleAccess(Boolean(res.data?.canAccess));
      })
      .catch(() => {
        if (!disposed) setSalesOrderRoleAccess(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    void API.get("/me")
      .then((response) => {
        if (disposed) return;
        setIsEmployee(Boolean(response.data?.person));
        const data = response.data?.user ?? response.data ?? {};
        const name =
          data.name ??
          data.fullName ??
          data.displayName ??
          data.username ??
          data.userName ??
          data.email ??
          data.Name ??
          data.Username ??
          data.UserName ??
          data.Email;
        if (String(name || "").trim()) setUserName(displayUserName(name));
      })
      .catch(() => undefined)
      .finally(() => { if (!disposed) setEmployeeLoaded(true); });
    return () => {
      disposed = true;
    };
  }, []);

  const allowedModules = useMemo(
    () =>
      MOBILE_MODULES.filter((module) => {
        if (!module.visible) return false;
        if (module.key === "rack") return canOpenRack;
        if (module.key === "salesOrders") {
          return (
            salesOrderRoleAccess ||
            canAccess("mobile.salesOrder", "view") ||
            canAccess("salesOrder", "view")
          );
        }

        const permission = MODULE_PERMISSIONS[module.key];
        return canAccess(permission.resource, permission.action);
      }),
    [canAccess, canOpenRack, salesOrderRoleAccess],
  );
  const hasModuleAccess = (module: MobileModule) =>
    allowedModules.some((allowed) => allowed.key === module && allowed.enabled);
  const selectedModule =
    activeModule &&
    (hasModuleAccess(activeModule) || (activeModule === "rack" && rackTarget))
      ? activeModule
      : null;
  const customerExperience = profileLoaded && employeeLoaded && (hasCustomerProfile || !isEmployee);
  const showCustomerHeader = customerExperience && !profileOpen && customerIdentity;
  const customerLocality = customerIdentity
    ? [customerIdentity.city, customerIdentity.pin]
        .filter(Boolean).join(", ")
    : "";
  const customerAddressLine2 = customerIdentity
    ? [customerIdentity.addressLine2, customerLocality].filter(Boolean).join(" · ")
    : "";

  const openModule = (module: MobileModule) => {
    if (!hasModuleAccess(module)) return;
    setProfileOpen(false);
    setActiveModule(module);
  };

  const goHome = () => {
    setActiveModule(null);
    setProfileOpen(false);
    setMenuOpen(false);
    setCustomerPortalKey((current) => current + 1);
  };

  const openCustomerEditor = (customer: CustomerUpdate) => {
    setCustomerFocusTarget({ id: customer.id, requestKey: Date.now(), customer });
    openModule("customers");
  };

  const returnToSalesOrder = (customer?: CustomerUpdate) => {
    if (customer) setCustomerUpdate(customer);
    setCustomerReturnFocusKey((current) => current + 1);
    setActiveModule("salesOrders");
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
    <main className="min-h-dvh bg-gray-100 pb-4 text-gray-800">
      <header className="sticky top-0 z-30 border-b border-blue-200 bg-blue-50/95 shadow-sm backdrop-blur">
        <div className={`relative mx-auto flex w-full max-w-3xl justify-between gap-3 px-3 py-2 sm:px-4 ${profileOpen ? "min-h-[94px] items-start sm:min-h-[61px] sm:items-center" : "min-h-[61px] items-center"}`}>
          <div aria-hidden="true" className={`pointer-events-none absolute inset-0 flex flex-col items-center overflow-hidden text-blue-900/25 ${profileOpen ? "justify-end pb-1 sm:justify-center sm:pb-0" : "justify-center"}`}>
            <span className="whitespace-nowrap text-2xl font-black leading-none tracking-wide sm:text-3xl">PharmaSys</span>
            <span className="whitespace-nowrap text-xs text-blue-400 font-bold tracking-wide sm:text-xl">Meena Agencies</span>
          </div>
          {profileOpen ? (
            <h1 className="relative min-w-0 text-lg font-bold text-blue-900">Profile</h1>
          ) : showCustomerHeader ? (
            <div className="relative min-w-0 flex-1 overflow-hidden py-0.5" aria-label="Customer identity">
              <div className="relative break-words text-blue-950">
                <h1 className="text-base font-bold leading-snug sm:text-lg">{customerIdentity.customerName}</h1>
                {customerIdentity.addressLine1 && <p className="text-xs leading-snug">{customerIdentity.addressLine1}</p>}
                {customerAddressLine2 && <p className="text-xs leading-snug">{customerAddressLine2}</p>}
              </div>
            </div>
          ) : (
            <div className="relative min-w-0 flex-1" aria-hidden="true" />
          )}

          {selectedModule && !profileOpen && (
            <div className="relative truncate text-sm font-bold text-blue-900">
              {MOBILE_MODULES.find((module) => module.key === selectedModule)?.label}
            </div>
          )}

          {profileOpen && profileStatus && (
            <div className="relative ml-auto text-right text-xs font-semibold text-blue-900 sm:text-sm">
              <strong>{profileStatus}</strong>
            </div>
          )}

          <div ref={menuRef} className={`relative ${profileOpen && profileStatus ? "" : "ml-auto"}`}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-blue-900 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <MenuIcon />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-xl" role="menu">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Logged in as</p>
                    <p className="mt-1 truncate font-bold text-slate-900">{userName}</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={goHome}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                  >
                    <HomeIcon />
                    Home
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setProfileOpen(true); setMenuOpen(false); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"
                  >
                    <span aria-hidden="true">▤</span>
                    Profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    <LogoutIcon />
                    Logout
                  </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {profileOpen ? (
        <Profile onBack={() => setProfileOpen(false)} onCredentialsChanged={onLogout} onUsernameChange={(name) => setUserName(displayUserName(name))} onStatusChange={setProfileStatus} onProfileSaved={(profile) => { setActiveModule(null); setHasCustomerProfile(true); setCustomerIdentity(customerIdentityFromProfile(profile)); setLinkedCustomer(profile.status === "LINKED" && Boolean(profile.customerId)); }} />
      ) : !profileLoaded || !employeeLoaded ? (
        <div className="mx-auto max-w-3xl px-4 py-5 text-sm text-slate-600">Checking customer profile...</div>
      ) : customerExperience ? (
        <CustomerPortalPage key={customerPortalKey} linked={linkedCustomer} onOpenProfile={() => setProfileOpen(true)} />
      ) : permissionsLoading ? (
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
              <CustomersPage
              canUpdateContact={canUpdateCustomerContact}
              focusCustomerId={customerFocusTarget?.id ?? null}
              focusRequestKey={customerFocusTarget?.requestKey ?? 0}
              focusCustomer={customerFocusTarget?.customer}
              onBackToSalesOrder={returnToSalesOrder}
            />
            </div>
          )}

          {hasModuleAccess("salesOrders") && (
            <div
              className={selectedModule === "salesOrders" ? "block" : "hidden"}
              aria-hidden={selectedModule !== "salesOrders"}
            >
              <SalesOrderPage
                onEditCustomer={openCustomerEditor}
                customerUpdate={customerUpdate}
                customerUpdateFocusRequestKey={customerReturnFocusKey}
              />
            </div>
          )}
        </>
      )}

    </main>
  );
}
