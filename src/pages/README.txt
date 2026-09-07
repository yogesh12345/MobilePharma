MobilePharma UI Revision 03

Changes
-------
1. Companies -> item -> Update Rack workflow:
   - After successful Update, automatically returns to the same Company's item list.
   - After Cancel, automatically returns to the same Company's item list.
   - The same item is scrolled into view and receives keyboard focus.
   - CompaniesPage stays mounted while Update Rack is active, preserving:
       * selected company
       * item search text
       * loaded items/current stock
       * list context

2. Zebra/alternate-row styling:
   - Company rows alternate white / light sky background.
   - Company item rows alternate white / light sky background.
   - Customer rows inside each expanded Area alternate white / light sky background.
   - Hover/focus states are enhanced.
   - The returned item receives a temporary amber-highlight/focus treatment.

3. Existing current-closing-stock implementation is retained.
   No mobileController.go change is required.

Replace:
  D:\MobilePharma\src\pages\CompaniesPage.tsx
  D:\MobilePharma\src\pages\CustomersPage.tsx
  D:\MobilePharma\src\pages\ItemLocationPage.tsx
  D:\MobilePharma\src\pages\MobileTabsPage.tsx

Then run:
  cd D:\MobilePharma
  npm run build
  npx cap sync android
