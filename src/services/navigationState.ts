type SavedNavigation = { view: string; module: string | null; shellView: string | null; companyId: number | null };

const PREFIX = "pharmasys:navigation:v1:";

export const navigationKey = (userId: number, customerId: number | null) =>
  `${PREFIX}${userId}:${customerId ?? "none"}`;

const selectedCustomerKey = (userId: number) => `${PREFIX}${userId}:selected-customer`;
export const taskStateKey = (navigationStateKey: string, task: string) => `${navigationStateKey}:task:${task}`;

export function readTaskState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function saveTaskState<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be disabled.
  }
}

export function removeTaskState(key: string) {
  try { localStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
}

export function readSelectedCustomer(userId: number): number | null {
  try {
    const id = Number(localStorage.getItem(selectedCustomerKey(userId)));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function saveSelectedCustomer(userId: number, id: number | null) {
  try {
    if (id) localStorage.setItem(selectedCustomerKey(userId), String(id));
    else localStorage.removeItem(selectedCustomerKey(userId));
  } catch {
    // Storage can be disabled.
  }
}

export function readNavigation(key: string): SavedNavigation {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return {
      view: typeof value?.view === "string" ? value.view : "home",
      module: typeof value?.module === "string" ? value.module : null,
      shellView: typeof value?.shellView === "string" ? value.shellView : null,
      companyId: Number.isSafeInteger(value?.companyId) && value.companyId > 0
        ? value.companyId : null,
    };
  } catch {
    return { view: "home", module: null, shellView: null, companyId: null };
  }
}

export function saveNavigation(key: string, patch: Partial<SavedNavigation>) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...readNavigation(key), ...patch }));
  } catch {
    // Storage can be disabled; navigation still works for the current page.
  }
}

export function clearNavigation() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage can be disabled.
  }
}
