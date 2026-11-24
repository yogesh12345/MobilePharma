import { useCallback, useEffect, useRef, useState } from "react";
import { MobileAccessProvider } from "./context/MobileAccessContext";
import LoginPage from "./pages/LoginPage";
import MobileTabsPage from "./pages/MobileTabsPage";
import NetworkStatusBanner from "./components/NetworkStatusBanner";
import {
  clearCachedPermissions,
  PermissionProvider,
} from "./context/PermissionContext";
import API, { setApiToken } from "./services/api";
import { getStoredToken, removeStoredToken, TOKEN_KEY } from "./services/storage";
import { clearNavigation } from "./services/navigationState";
import { clearInteractionTime, ensureInteractionTime, idleExpired, IDLE_LIMIT_MS, LAST_ACTIVITY_KEY, lastInteraction, recordInteraction } from "./services/idleSession";

type AuthState = "checking" | "authenticated" | "guest";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [loggedInUserName, setLoggedInUserName] = useState("User");
  const authEpoch = useRef(0);

  const logout = useCallback(async () => {
    authEpoch.current += 1;
    setApiToken(null);
    clearNavigation();
    clearInteractionTime();
    setAuthState("guest");
    await Promise.all([removeStoredToken(), clearCachedPermissions()]);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => { void logout(); };

    window.addEventListener(
      "pharmasys:unauthorized",
      handleUnauthorized,
    );

    return () => {
      window.removeEventListener(
        "pharmasys:unauthorized",
        handleUnauthorized,
      );
    };
  }, [logout]);

  useEffect(() => {
    let disposed = false;

    const checkSession = async () => {
      const epoch = authEpoch.current;
      const token = await getStoredToken();
      if (disposed || epoch !== authEpoch.current) return;

      if (!token) {
        setApiToken(null);
        clearInteractionTime();
        setAuthState("guest");
        return;
      }

      ensureInteractionTime();
      if (idleExpired()) { void logout(); return; }
      setApiToken(token);

      try {
        await API.get("/me");
        if (disposed || epoch !== authEpoch.current) return;
        if (idleExpired()) { void logout(); return; }
        setAuthState("authenticated");
      } catch (error) {
        const maybeAxios = error as { response?: { status?: number } };
        if (disposed || epoch !== authEpoch.current) return;
        if (idleExpired()) { void logout(); return; }

        if (maybeAxios.response?.status === 401) {
          setAuthState("guest");
          return;
        }

        setAuthState("authenticated");
      }
    };

    void checkSession();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkSession();
    };

    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [logout]);

  useEffect(() => {
    if (authState !== "authenticated") return;
    let timer: number | undefined;
    let lastWrite = lastInteraction() ?? 0;
    const schedule = () => {
      window.clearTimeout(timer);
      const remaining = IDLE_LIMIT_MS - (Date.now() - ensureInteractionTime());
      if (remaining <= 0) { void logout(); return; }
      timer = window.setTimeout(schedule, remaining + 50);
    };
    const activity = () => {
      if (idleExpired()) { void logout(); return; }
      const now = Date.now();
      if (now - lastWrite < 1000) return;
      lastWrite = now;
      recordInteraction(now);
      schedule();
    };
    const checkOnReturn = () => { if (document.visibilityState === "visible") schedule(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY && event.newValue === null) { void logout(); return; }
      if (event.key === LAST_ACTIVITY_KEY) schedule();
    };
    const events = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel", "scroll"];
    events.forEach(event => window.addEventListener(event, activity, { passive: true, capture: true }));
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", checkOnReturn);
    window.addEventListener("storage", onStorage);
    schedule();
    return () => {
      window.clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, activity, true));
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", checkOnReturn);
      window.removeEventListener("storage", onStorage);
    };
  }, [authState, logout]);

  return (
    <>
      <NetworkStatusBanner />
      {authState === "checking" ? (
        <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 text-sm font-semibold text-slate-600">
          Checking session...
        </main>
      ) : authState === "authenticated" ? (
        <PermissionProvider>
          <MobileAccessProvider><MobileTabsPage onLogout={logout} initialUserName={loggedInUserName} /></MobileAccessProvider>
        </PermissionProvider>
      ) : (
        <LoginPage
          onLogin={(identifier) => {
            recordInteraction();
            if (identifier) setLoggedInUserName(identifier);
            setAuthState("authenticated");
          }}
        />
      )}
    </>
  );
}
