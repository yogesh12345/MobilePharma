import type { LauncherModule, MobileModule } from "./mobileModules";

interface AppLauncherProps {
  modules: LauncherModule[];
  onOpen: (module: MobileModule) => void;
}

export default function AppLauncher({ modules, onOpen }: AppLauncherProps) {
  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <div className="grid min-h-[calc(100dvh-109px)] grid-cols-2 content-start gap-x-6 gap-y-8 rounded-md border border-blue-100 bg-white/70 px-5 py-6 shadow-sm sm:grid-cols-4 sm:px-8 sm:py-8">
        {modules.map((module) => (
          <button
            key={module.key}
            type="button"
            onClick={() => module.enabled && onOpen(module.key)}
            disabled={!module.enabled}
            className={`flex w-24 flex-col items-center gap-2 ${module.positionClass} text-center transition enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-28`}
          >
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-lg border border-white shadow-sm ${module.icon.bgClass} ${module.icon.fgClass} sm:h-20 sm:w-20`}
              aria-hidden="true"
            >
              <svg
                className="h-9 w-9 sm:h-11 sm:w-11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {module.icon.icon}
              </svg>
            </span>
            <span className="min-h-9 text-xs font-semibold leading-tight text-slate-700 sm:text-sm">
              {module.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
