export type ProfileForm = {
  customerName: string; category: string; addressLine1: string; addressLine2: string;
  city: string; district: string; state: string; country: string; pin: string;
  gstNo: string; pan: string; contactPerson: string; mobileNo: string;
  whatsAppNo: string; emailId: string; username: string; remark: string;
};

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
