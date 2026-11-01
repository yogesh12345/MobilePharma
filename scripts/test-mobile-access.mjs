import assert from "node:assert/strict";
import { test } from "node:test";
import { isMobileAccessData, mobileAccessErrorMessage, mobileBackendUpdateMessage } from "../src/context/mobileAccessResponse.ts";
import { checkMobileBackend } from "./check-mobile-backend.mjs";

const data = () => ({
  account: { userId: 1, kind: "EXTERNAL", active: true },
  user: { username: "owner", name: "Owner", email: "owner@example.com", whatsapp: "", emailVerified: true, whatsappVerified: false },
  customers: [{ customerId: 2, customerName: "Customer", gstNo: "", permissions: ["catalog"], owner: true }],
});

test("accepts pending viewers, internal assignments and external owner access", () => {
  for (const kind of ["PENDING", "INTERNAL", "EXTERNAL"]) {
    const value = data(); value.account.kind = kind;
    if (kind === "PENDING") value.customers = [];
    assert.equal(isMobileAccessData(value), true);
  }
});
test("rejects HTML fallback, malformed payloads and unsafe permission structures", () => {
  for (const value of [null, "<!doctype html><html>app</html>", {}, { ...data(), customers: null },
    { ...data(), account: { userId: 1, kind: "ADMIN", active: true } },
    { ...data(), customers: [{ ...data().customers[0], permissions: null }] }]) {
    assert.equal(isMobileAccessData(value), false);
  }
});
test("distinguishes missing backend from session, permission, network and service failures", () => {
  assert.equal(mobileAccessErrorMessage({ response: { status: 404 } }), mobileBackendUpdateMessage);
  assert.match(mobileAccessErrorMessage({ response: { status: 401 } }), /session has expired/);
  assert.match(mobileAccessErrorMessage({ response: { status: 403 } }), /inactive or access is restricted/);
  assert.match(mobileAccessErrorMessage({ response: { status: 503 } }), /account service is unavailable/);
  assert.match(mobileAccessErrorMessage(new Error("offline")), /connection/);
});
test("deployment accepts an existing protected account-access route", async () => {
  await checkMobileBackend("https://example.test", async (url, options) => {
    assert.equal(String(url), "https://example.test/mobile/access");
    assert.equal(options.headers.Authorization, undefined);
    return new Response(JSON.stringify({ error: "Token required" }), { status: 401, headers: { "content-type": "application/json" } });
  });
});
test("deployment rejects a missing route, SPA fallback and unavailable service", async () => {
  for (const [status, body, contentType] of [[404, "404 page not found", "text/plain"],
    [200, "<!doctype html>app", "text/html"], [503, '{"error":"unavailable"}', "application/json"],
    [403, '{"error":"Desktop launcher proof required"}', "application/json"], [401, '{}', "application/json"]]) {
    await assert.rejects(checkMobileBackend("https://example.test", async () => new Response(body, { status, headers: { "content-type": contentType } })), /Deploy and restart the updated Go backend/);
  }
});
test("deployment reports network failures", async () => {
  await assert.rejects(checkMobileBackend("https://example.test", async () => { throw new Error("Network unavailable"); }), /Network unavailable/);
});
