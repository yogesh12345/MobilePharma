export type ProfileForm = {
  customerName: string; category: string; addressLine1: string; addressLine2: string;
  city: string; district: string; state: string; country: string; pin: string;
  gstNo: string; pan: string; contactPerson: string; mobileNo: string;
  whatsAppNo: string; emailId: string; username: string; remark: string;
};

export type CustomerIdentity = Pick<ProfileForm,
  "customerName" | "addressLine1" | "addressLine2" | "city" | "district" | "state" | "pin"
>;

export function customerIdentityFromProfile(profile: Record<string, unknown> | null | undefined): CustomerIdentity | null {
  const customerName = String(profile?.customerName ?? "").trim();
  const addressLine1 = String(profile?.addressLine1 ?? "").trim();
  if (!customerName || !addressLine1) return null;

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

export const emptyForm: ProfileForm = {
  customerName: "", category: "", addressLine1: "", addressLine2: "",
  city: "", district: "", state: "", country: "India", pin: "", gstNo: "", pan: "",
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
