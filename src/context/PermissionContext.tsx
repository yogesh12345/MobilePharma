import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import API from "../services/api";
import {
  getStoredPermissions,
  removeStoredPermissions,
  setStoredPermissions,
} from "../services/storage";
import { can, normalizePermList, type EffPerm } from "../services/rbac";

type PermissionContextValue = {
  permissions: EffPerm[];
  loading: boolean;
  reloadPermissions: () => Promise<void>;
  canAccess: (resource: string, action?: string) => boolean;
};

const PermissionContext = createContext<PermissionContextValue>({
  permissions: [],
  loading: true,
  reloadPermissions: async () => {},
  canAccess: () => false,
});

const readCachedPermissions = async () => {
  const raw = await getStoredPermissions();
  if (!raw) return [];

  try {
    return normalizePermList(JSON.parse(raw));
  } catch {
    return [];
  }
};

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<EffPerm[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadPermissions = useCallback(async () => {
    setLoading(true);

    try {
      const response = await API.get("/me/permissions");
      const normalized = normalizePermList(response.data?.permissions ?? []);
      setPermissions(normalized);
      await setStoredPermissions(JSON.stringify(normalized));
    } catch (error) {
      console.error("Failed to load permissions", error);
      const cached = await readCachedPermissions();
      setPermissions(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    const hydrate = async () => {
      const cached = await readCachedPermissions();
      if (!disposed && cached.length > 0) {
        setPermissions(cached);
        setLoading(false);
      }

      if (!disposed) {
        await reloadPermissions();
      }
    };

    void hydrate();

    return () => {
      disposed = true;
    };
  }, [reloadPermissions]);

  const canAccess = useCallback(
    (resource: string, action?: string) => can(permissions, resource, action),
    [permissions],
  );

  return (
    <PermissionContext.Provider
      value={{ permissions, loading, reloadPermissions, canAccess }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export const clearCachedPermissions = () => removeStoredPermissions();

export function usePermissions() {
  return useContext(PermissionContext);
}
