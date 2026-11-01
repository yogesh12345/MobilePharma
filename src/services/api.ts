import axios from "axios";
import { removeStoredToken, TOKEN_KEY } from "./storage";

let mobileCustomerId: number | null = null;
export function setMobileCustomerId(id: number | null) { mobileCustomerId = id; }

let cachedToken = localStorage.getItem(TOKEN_KEY);

export function setApiToken(token: string | null) {
  if (cachedToken !== token) mobileCustomerId = null;
  cachedToken = token;
}

const notifyConnectivity = (online: boolean, reason?: "network" | "server") => {
  window.dispatchEvent(
    new CustomEvent("pharmasys:connectivity", {
      detail: { online, reason },
    }),
  );
};

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || window.location.origin,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use((config) => {
  if (mobileCustomerId) config.headers["X-Mobile-Customer-ID"] = String(mobileCustomerId);
  const token = cachedToken || localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => {
    notifyConnectivity(true);
    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      setApiToken(null);
      void removeStoredToken();
      window.dispatchEvent(new Event("pharmasys:unauthorized"));
    } else if (!error?.response && navigator.onLine === false) {
      notifyConnectivity(false, "network");
    }
    return Promise.reject(error);
  },
);

export default API;
