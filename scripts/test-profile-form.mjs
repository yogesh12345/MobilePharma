import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyForm, profileFormFromResponse, profileSavePayload } from "../src/pages/profileForm.ts";

test("profile save sends only editable fields from an existing profile", () => {
  const profile = {
    ...emptyForm,
    customerName: "  Example practice  ",
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
  assert.equal("id" in payload, false);
  assert.equal("customerId" in payload, false);
});

test("missing optional fields cannot throw during save", () => {
  const form = profileFormFromResponse({ ...emptyForm, remark: null, whatsAppNo: null }, "new-name");
  const payload = profileSavePayload(form);
  assert.equal(payload.remark, "");
  assert.equal(payload.whatsAppNo, "");
});
