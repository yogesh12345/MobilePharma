import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import MobileTabsPage from "./pages/MobileTabsPage";
import NetworkStatusBanner from "./components/NetworkStatusBanner";
import {
  clearCachedPermissions,
  PermissionProvider,
} from "./context/PermissionContext";
import API, { setApiToken } from "./services/api";
import { getStoredToken, removeStoredToken } from "./services/storage";

type AuthState = "checking" | "authenticated" | "guest";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    const handleUnauthorized = () => {
      setApiToken(null);
      void removeStoredToken();
      void clearCachedPermissions();
      setAuthState("guest");
    };

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
  }, []);

  useEffect(() => {
    let disposed = false;

    const checkSession = async () => {
      const token = await getStoredToken();
      if (disposed) return;

      if (!token) {
        setApiToken(null);
        setAuthState("guest");
        return;
      }

      setApiToken(token);

      try {
        await API.get("/me");
        if (!disposed) setAuthState("authenticated");
      } catch (error) {
        const maybeAxios = error as { response?: { status?: number } };
        if (disposed) return;

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
  }, []);

  const logout = async () => {
    setApiToken(null);
    await removeStoredToken();
    await clearCachedPermissions();
    setAuthState("guest");
  };

  return (
    <>
      <NetworkStatusBanner />
      {authState === "checking" ? (
        <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 text-sm font-semibold text-slate-600">
          Checking session...
        </main>
      ) : authState === "authenticated" ? (
        <PermissionProvider>
          <MobileTabsPage onLogout={logout} />
        </PermissionProvider>
      ) : (
        <LoginPage onLogin={() => setAuthState("authenticated")} />
      )}
    </>
  );
}
