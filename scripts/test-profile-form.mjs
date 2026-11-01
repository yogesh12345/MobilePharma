import assert from "node:assert/strict";
import { test } from "node:test";
import { customerIdentityFromLinkedCustomer, customerIdentityFromProfile, emptyForm, profileFormFromResponse, profileSavePayload } from "../src/pages/profileForm.ts";

test("linked customer name remains visible when an older profile response lacks an address", () => {
  assert.equal(customerIdentityFromProfile({ customerName: "Balaji Medical", addressLine1: "" })?.customerName, "Balaji Medical");
  assert.equal(customerIdentityFromProfile({ customerName: "", addressLine1: "Street" }), null);
});

test("linked customer record supplies header identity when profile fields are blank", () => {
  const identity = customerIdentityFromLinkedCustomer(
    { CustomerName: "Balaji Medical", AddressLine1: "Shop 3", AddressLine2: "Gole Colony" },
    { customerName: "", addressLine1: "", city: "Nashik", pin: "422002" },
  );
  assert.equal(identity?.customerName, "Balaji Medical");
  assert.equal(identity?.addressLine1, "Shop 3");
  assert.equal(identity?.addressLine2, "Gole Colony");
  assert.equal(identity?.city, "Nashik");
  assert.equal(identity?.pin, "422002");
});

test("profile save sends only editable fields from an existing profile", () => {
  const profile = {
    ...emptyForm,
    customerName: "  Example practice  ",
    drugLicNo1: "  DL-123  ",
    drugLicNo2: "DL-456",
    foodLicenseNo: "FSSAI-789",
    username: "old-name",
    id: 1,
    userId: 14,
    customerId: null,
    status: "LINKED",
  };
  const form = profileFormFromResponse(profile, "new-name");
  const payload = profileSavePayload({ ...form, city: "  Updated city  " });

  assert.deepEqual(Object.keys(payload), Object.keys(emptyForm));
  assert.equal(payload.customerName, "Example practice");
  assert.equal(payload.username, "new-name");
  assert.equal(payload.city, "Updated city");
  assert.equal(payload.drugLicNo1, "DL-123");
  assert.equal(payload.drugLicNo2, "DL-456");
  assert.equal(payload.foodLicenseNo, "FSSAI-789");
  assert.equal("id" in payload, false);
  assert.equal("customerId" in payload, false);
});

test("missing optional fields cannot throw during save", () => {
  const form = profileFormFromResponse({ ...emptyForm, remark: null, whatsAppNo: null, drugLicNo1: null, drugLicNo2: null, foodLicenseNo: null }, "new-name");
  const payload = profileSavePayload(form);
  assert.equal(payload.remark, "");
  assert.equal(payload.whatsAppNo, "");
  assert.equal(payload.drugLicNo1, "");
  assert.equal(payload.drugLicNo2, "");
  assert.equal(payload.foodLicenseNo, "");
});
