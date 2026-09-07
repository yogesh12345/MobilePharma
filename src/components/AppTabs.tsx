type MobileTab = "rack" | "companies" | "customers";

interface AppTabsProps {
  activeTab: MobileTab;
  onChange: (tab: MobileTab) => void;
}

const tabs: Array<{ key: MobileTab; label: string }> = [
  { key: "rack", label: "Update Rack" },
  { key: "companies", label: "Companies" },
  { key: "customers", label: "Customers" },
];

export type { MobileTab };

export default function AppTabs({ activeTab, onChange }: AppTabsProps) {
  return (
    <nav className="sticky top-[61px] z-20 border-b border-blue-200 bg-white shadow-sm">
      <div className="mx-auto grid w-full max-w-3xl grid-cols-3">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`min-h-11 border-b-2 px-2 py-2 text-sm font-semibold transition ${
                active
                  ? "border-blue-600 bg-blue-50 text-blue-800"
                  : "border-transparent text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
