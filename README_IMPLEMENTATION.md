# MobilePharma tab implementation

## Frontend placement

Copy:
- `AppTabs.tsx` -> `D:\MobilePharma\src\components\AppTabs.tsx`
- `CompaniesPage.tsx` -> `D:\MobilePharma\src\pages\CompaniesPage.tsx`
- `CustomersPage.tsx` -> `D:\MobilePharma\src\pages\CustomersPage.tsx`
- `MobileTabsPage.tsx` -> `D:\MobilePharma\src\pages\MobileTabsPage.tsx`
- `ItemLocationPage.tsx` -> replace current `D:\MobilePharma\src\pages\ItemLocationPage.tsx`

In your existing App.tsx, after login succeeds, render:
```tsx
<MobileTabsPage onLogout={handleLogout} />
```
instead of rendering `ItemLocationPage` directly.

Add:
```tsx
import MobileTabsPage from "./pages/MobileTabsPage";
```

## Backend

Copy `mobileController.go` to your backend `controllers` folder.

Add the routes in `protected_routes_additions.txt` inside `ProtectedRoutes`.

Restart backend.

## Rate / Stock logic

- PTR = `batchDetails.RetRate`
- MRP = `batchDetails.MRP`
- Both are selected from the batchDetails row with the latest `PurDate`.
- If PurDate ties, latest EffectiveFromDate/TrnDate and BatSrNo are used as deterministic tie-breakers.
- Stock = total SUM of `nstkopbal.qty1` and `nstkopbal.qty2` across all batches and locations for the item.

## Customer logic

Current-month sales:
- Cash: TrnType1 = 10
- Credit: TrnType1 = 20
- from 1st of current month through CURDATE()
- deleted invoices excluded
- InvoiceStatus > 0

Customer contact storage used by this implementation:
- Mobile No. -> `customers.PhoneNo`
- WhatsApp No. -> `customers.SalesInvDefaultWhatsapp`
- Email ID -> `customers.EmailID`

Display fallback for Mobile/WhatsApp/Email also reads the primary `contacts` row if the customer-level value is blank.

Area mapping assumes `params.ParamGroup = 'AREA'`. If your live Area group uses another ParamGroup code, change that one literal in `mobileController.go`.
