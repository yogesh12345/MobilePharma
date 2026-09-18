import type { ReactNode } from "react";

type MobileModule =
  | "rack"
  | "purchases"
  | "companies"
  | "customers"
  | "salesOrders";

type ModuleIcon = {
  bgClass: string;
  fgClass: string;
  icon: ReactNode;
};

type LauncherModule = {
  key: MobileModule;
  label: string;
  visible: boolean;
  enabled: boolean;
  positionClass: string;
  icon: ModuleIcon;
};

const moduleIcons: Record<MobileModule, ModuleIcon> = {
  rack: {
    bgClass: "bg-emerald-100",
    fgClass: "text-emerald-700",
    icon: (
      <>
        <path d="M5 6.5h14" />
        <path d="M5 12h14" />
        <path d="M5 17.5h14" />
        <path d="M7 4.5v15" />
        <path d="M17 4.5v15" />
      </>
    ),
  },
  purchases: {
    bgClass: "bg-amber-100",
    fgClass: "text-amber-700",
    icon: (
      <>
        <path d="M7 7h14l-2 8H9L7 7Z" />
        <path d="M7 7 6 4H3" />
        <circle cx="10" cy="19" r="1.25" />
        <circle cx="18" cy="19" r="1.25" />
      </>
    ),
  },
  companies: {
    bgClass: "bg-sky-100",
    fgClass: "text-sky-700",
    icon: (
      <>
        <path d="M5 20V6.5A1.5 1.5 0 0 1 6.5 5h8A1.5 1.5 0 0 1 16 6.5V20" />
        <path d="M16 10h2.5A1.5 1.5 0 0 1 20 11.5V20" />
        <path d="M8 9h1.5" />
        <path d="M12 9h1.5" />
        <path d="M8 13h1.5" />
        <path d="M12 13h1.5" />
        <path d="M9 20v-3h3v3" />
      </>
    ),
  },
  customers: {
    bgClass: "bg-rose-100",
    fgClass: "text-rose-700",
    icon: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M17.5 7.5a2.5 2.5 0 0 1 0 5" />
      </>
    ),
  },
  salesOrders: {
    bgClass: "bg-violet-100",
    fgClass: "text-violet-700",
    icon: (
      <>
        <path d="M7 6h12l-1.5 8.5H8.5L7 6Z" />
        <path d="M7 6 6 3.5H3.5" />
        <path d="M9 10h7" />
        <path d="M9.5 13h4" />
        <circle cx="10" cy="19" r="1.25" />
        <circle cx="17" cy="19" r="1.25" />
      </>
    ),
  },
};

export const MOBILE_MODULES: LauncherModule[] = [
  {
    key: "rack",
    label: "Update Racks",
    visible: true,
    enabled: true,
    positionClass: "justify-self-start",
    icon: moduleIcons.rack,
  },
  {
    key: "purchases",
    label: "Purchases",
    visible: true,
    enabled: true,
    positionClass: "justify-self-center",
    icon: moduleIcons.purchases,
  },
  {
    key: "companies",
    label: "Companies",
    visible: true,
    enabled: true,
    positionClass: "justify-self-center",
    icon: moduleIcons.companies,
  },
  {
    key: "customers",
    label: "Customers",
    visible: true,
    enabled: true,
    positionClass: "justify-self-end",
    icon: moduleIcons.customers,
  },
  {
    key: "salesOrders",
    label: "Sales Order",
    visible: true,
    enabled: true,
    positionClass: "justify-self-start",
    icon: moduleIcons.salesOrders,
  },
];

export type { LauncherModule, MobileModule };
