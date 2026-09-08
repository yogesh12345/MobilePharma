import { Preferences } from "@capacitor/preferences";

const canUsePreferences =
  typeof window !== "undefined" && typeof Preferences?.get === "function";

export const TOKEN_KEY = "pharmasys_token";
export const ACTIVE_TAB_KEY = "mobileActiveTab";

export async function getStoredValue(key: string) {
  if (canUsePreferences) {
    try {
      const result = await Preferences.get({ key });
      if (result.value !== null) return result.value;
    } catch {
      // Browser fallback below.
    }
  }

  return localStorage.getItem(key);
}

export async function setStoredValue(key: string, value: string) {
  localStorage.setItem(key, value);

  if (canUsePreferences) {
    try {
      await Preferences.set({ key, value });
    } catch {
      // localStorage already has the value for web/dev fallback.
    }
  }
}

export async function removeStoredValue(key: string) {
  localStorage.removeItem(key);

  if (canUsePreferences) {
    try {
      await Preferences.remove({ key });
    } catch {
      // localStorage was cleared; nothing else to do in browser fallback.
    }
  }
}

export const getStoredToken = () => getStoredValue(TOKEN_KEY);
export const setStoredToken = (token: string) => setStoredValue(TOKEN_KEY, token);
export const removeStoredToken = () => removeStoredValue(TOKEN_KEY);
