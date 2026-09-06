import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import ItemLocationPage from "./pages/ItemLocationPage";

export default function App() {
  const [authenticated, setAuthenticated] = useState(
    () => !!localStorage.getItem("pharmasys_token"),
  );

  useEffect(() => {
    const handleUnauthorized = () => setAuthenticated(false);
    window.addEventListener("pharmasys:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("pharmasys:unauthorized", handleUnauthorized);
  }, []);

  const logout = () => {
    localStorage.removeItem("pharmasys_token");
    setAuthenticated(false);
  };

  return authenticated ? (
    <ItemLocationPage onLogout={logout} />
  ) : (
    <LoginPage onLogin={() => setAuthenticated(true)} />
  );
}
