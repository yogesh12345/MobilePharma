import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";

type ConnectivityStatus = "online" | "offline";

type ConnectivityEvent = CustomEvent<{
  online: boolean;
  reason?: "network" | "server";
}>;

const getBrowserOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

export default function NetworkStatusBanner() {
  const [status, setStatus] = useState<ConnectivityStatus>(
    getBrowserOnline() ? "online" : "offline",
  );

  useEffect(() => {
    let disposed = false;
    let removeNetworkListener: (() => void) | undefined;

    const updateNetworkState = async () => {
      try {
        const state = await Network.getStatus();
        if (!disposed) setStatus(state.connected ? "online" : "offline");
      } catch {
        if (!disposed) setStatus(getBrowserOnline() ? "online" : "offline");
      }
    };

    const handleConnectivityEvent = (event: Event) => {
      const detail = (event as ConnectivityEvent).detail;
      if (detail?.online) {
        setStatus("online");
        return;
      }
      if (detail?.reason === "network") setStatus("offline");
    };

    const handleOnline = () => setStatus("online");

    const handleOffline = () => setStatus("offline");

    void updateNetworkState();

    Network.addListener("networkStatusChange", (state) => {
      setStatus(state.connected ? "online" : "offline");
    }).then((handle) => {
      removeNetworkListener = () => {
        void handle.remove();
      };
    });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pharmasys:connectivity", handleConnectivityEvent);

    return () => {
      disposed = true;
      removeNetworkListener?.();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pharmasys:connectivity", handleConnectivityEvent);
    };
  }, []);

  if (status === "online") return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-900 shadow-sm">
      No internet connection. Changes may not load until data is back.
    </div>
  );
}
