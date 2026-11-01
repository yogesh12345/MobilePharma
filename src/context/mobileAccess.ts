import { createContext, useContext } from "react";
export type MobileCustomer = { customerId: number; customerName: string; gstNo: string; permissions: string[]; owner: boolean };
export type AccessData = { account: { userId: number; kind: "PENDING" | "INTERNAL" | "EXTERNAL"; active: boolean }; user: { username: string; name: string; email: string; whatsapp: string; emailVerified: boolean; whatsappVerified: boolean }; customers: MobileCustomer[] };
export type AccessContext = { data: AccessData | null; customer: MobileCustomer | null; loading: boolean; error: string; can: (permission: string) => boolean; selectCustomer: (id: number | null) => void; reload: () => Promise<void> };
export const MobileAccessContext = createContext<AccessContext>({ data: null, customer: null, loading: true, error: "", can: () => false, selectCustomer: () => {}, reload: async () => {} });

export const useMobileAccess = () => useContext(MobileAccessContext);
