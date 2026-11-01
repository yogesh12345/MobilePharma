export type ProfileForm = {
  customerName: string; category: string; addressLine1: string; addressLine2: string;
  city: string; district: string; state: string; country: string; pin: string;
  gstNo: string; pan: string; drugLicNo1: string; drugLicNo2: string; foodLicenseNo: string;
  contactPerson: string; mobileNo: string;
  whatsAppNo: string; emailId: string; username: string; remark: string;
};

export type CustomerIdentity = Pick<ProfileForm,
  "customerName" | "addressLine1" | "addressLine2" | "city" | "district" | "state" | "pin"
>;

export function customerIdentityFromProfile(profile: Record<string, unknown> | null | undefined): CustomerIdentity | null {
  const customerName = String(profile?.customerName ?? "").trim();
  const addressLine1 = String(profile?.addressLine1 ?? "").trim();
  // A linked customer can have an incomplete address on an older server.
  // Keep its name visible while the missing address is populated from the
  // linked customer record by the profile API.
  if (!customerName) return null;

  return {
    customerName,
    addressLine1,
    addressLine2: String(profile?.addressLine2 ?? "").trim(),
    city: String(profile?.city ?? "").trim(),
    district: String(profile?.district ?? "").trim(),
    state: String(profile?.state ?? "").trim(),
    pin: String(profile?.pin ?? "").trim(),
  };
}

export function customerIdentityFromLinkedCustomer(
  customer: Record<string, unknown> | null | undefined,
  profile: Record<string, unknown> | null | undefined,
): CustomerIdentity | null {
  const fromProfile = customerIdentityFromProfile(profile);
  const customerName = String(customer?.CustomerName ?? "").trim() || fromProfile?.customerName || "";
  if (!customerName) return fromProfile;

  return {
    customerName,
    addressLine1: String(customer?.AddressLine1 ?? "").trim() || String(profile?.addressLine1 ?? "").trim(),
    addressLine2: String(customer?.AddressLine2 ?? "").trim() || String(profile?.addressLine2 ?? "").trim(),
    city: String(profile?.city ?? "").trim(),
    district: String(profile?.district ?? "").trim(),
    state: String(profile?.state ?? "").trim(),
    pin: String(profile?.pin ?? "").trim(),
  };
}

export const emptyForm: ProfileForm = {
  customerName: "", category: "", addressLine1: "", addressLine2: "",
  city: "", district: "", state: "", country: "India", pin: "", gstNo: "", pan: "",
  drugLicNo1: "", drugLicNo2: "", foodLicenseNo: "",
  contactPerson: "", mobileNo: "", whatsAppNo: "", emailId: "", username: "", remark: "",
};

const keys = Object.keys(emptyForm) as (keyof ProfileForm)[];

export function profileFormFromResponse(profile: Record<string, unknown> | null, username: unknown, emailId?: unknown): ProfileForm {
  return Object.fromEntries(keys.map((key) => [
    key,
    String((key === "username" ? username : key === "emailId" ? profile?.emailId ?? emailId : profile?.[key]) ?? emptyForm[key]),
  ])) as ProfileForm;
}

export function profileSavePayload(form: ProfileForm): ProfileForm {
  return Object.fromEntries(keys.map((key) => [key, String(form[key] ?? "").trim()])) as ProfileForm;
}
