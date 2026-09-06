PharmaSys Mobile - Initial Source Set
=====================================

Copy/merge these files into D:\MobilePharma.

1) Dependencies expected in your existing Vite project:
   npm install axios
   npm install tailwindcss @tailwindcss/vite

2) Create D:\MobilePharma\.env from .env.example.
   Recommended production/test-over-Internet value:
   VITE_API_BASE_URL=https://back.meenaagencies.co.in

3) Start browser test:
   npm run dev

4) Test workflow:
   - Login with existing PharmaSys username/email and password.
   - Search an item with 3+ characters.
   - Select item.
   - Confirm Item Name, Packing, Box Packing, Company Name, Company Short.
   - Change Location / Rack No.
   - Click Update.
   - Search the same item again and confirm Rack No. persisted.

5) Do NOT run `npx cap add android` until browser/API testing works.

Backend endpoints used:
   POST /login
   GET  /item/autocomplete?query=...
   GET  /itemdetail/:id
   PUT  /item/:id   body: { "RackNumber": "..." }

Notes:
- The supplied GenericAutoComplete.tsx is the existing PharmaSys component.
- The supplied FloatingLabelInput.tsx is the existing PharmaSys component.
- The read-only item fields are disabled; only RackNumber is editable.
- RackNumber is limited to 15 characters to match the Go model.
