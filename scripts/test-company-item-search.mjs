import assert from "node:assert/strict";
import { test } from "node:test";
import { searchCompanyItems } from "../src/pages/companyItemSearch.ts";

const items = [
  { ItemName: "AZRO 100 MG. SUSP.", Packing: "30 ML" },
  { ItemName: "AZRO 200 SUSPENSION.", Packing: "30 ML" },
  { ItemName: "AZRO 250 TABLETS.", Packing: "10'S" },
  { ItemName: "AZRO 500 TABLETS.", Packing: "5'S" },
];

test("separate search words match anywhere in an item name", () => {
  assert.deepEqual(searchCompanyItems(items, "az 2").map((item) => item.ItemName), [
    "AZRO 200 SUSPENSION.",
    "AZRO 250 TABLETS.",
  ]);
  assert.equal(searchCompanyItems(items, "250 azro").length, 1);
});

test("search also matches packing and ignores extra spaces", () => {
  assert.equal(searchCompanyItems(items, "  azro   30 ml  ").length, 2);
  assert.equal(searchCompanyItems(items, " ").length, items.length);
});
