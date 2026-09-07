import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import MobileTabsPage from "./pages/MobileTabsPage";

export default function App() {
  const [authenticated, setAuthenticated] = useState(
    () => !!localStorage.getItem("pharmasys_token"),
  );

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem("pharmasys_token");
      setAuthenticated(false);
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

  const logout = () => {
    localStorage.removeItem("pharmasys_token");
    setAuthenticated(false);
  };

  return authenticated ? (
    <MobileTabsPage onLogout={logout} />
  ) : (
    <LoginPage onLogin={() => setAuthenticated(true)} />
  );
}