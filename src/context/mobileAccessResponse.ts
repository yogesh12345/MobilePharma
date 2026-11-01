import type { AccessData } from "./mobileAccess";

export const mobileBackendUpdateMessage = "The server needs an update before MobilePharma can open. Please contact your administrator to update and restart the backend.";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const positiveID = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

export function isMobileAccessData(value: unknown): value is AccessData {
  if (!record(value) || !record(value.account) || !record(value.user) || !Array.isArray(value.customers)) return false;
  const { account, user, customers } = value;
  return positiveID(account.userId) && ["PENDING", "INTERNAL", "EXTERNAL"].includes(String(account.kind))
    && typeof account.active === "boolean"
    && ["username", "name", "email", "whatsapp"].every((key) => typeof user[key] === "string")
    && typeof user.emailVerified === "boolean" && typeof user.whatsappVerified === "boolean"
    && customers.every((customer) => record(customer) && positiveID(customer.customerId)
      && typeof customer.customerName === "string" && typeof customer.gstNo === "string"
      && typeof customer.owner === "boolean" && Array.isArray(customer.permissions)
      && customer.permissions.every((permission: unknown) => typeof permission === "string"));
}

export function mobileAccessErrorMessage(error: unknown): string {
  const status = record(error) && record(error.response) ? error.response.status : undefined;
  if (status === 404) return mobileBackendUpdateMessage;
  if (status === 403) return "Your account is inactive or access is restricted. Please contact your administrator, or sign in with another account.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (typeof status === "number" && status >= 500) return "The account service is unavailable. Please retry later or contact your administrator.";
  return "Unable to connect to your account service. Check your connection and retry.";
}
