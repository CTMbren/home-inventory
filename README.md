# Home Inventory

A phone-friendly web app (PWA) for scanning household products and tracking which room and spot each one lives in. Built with React + Vite, Supabase (database, sign-in, live sync) and the ZXing barcode reader. Hosted free on GitHub Pages.

## What works in this prototype

- Email + password accounts; a shared **household** you invite others into with a code
- **Rooms and locations** (starter set offered on first run; add, rename, delete)
- **Scan** with the phone camera (UPC/EAN, Code 128, QR), or type a barcode
  - Known product → see where it is, “Used one”, or add more
  - New product → looked up in Open Food Facts, Open Beauty Facts, Open Products Facts (and UPCitemdb once the lookup function is deployed), then pick a location and quantity
  - Items without barcodes can be added by hand
- **Home** list grouped by room and location, search, room filter, +/− counts, a “Ran out” section
- Tap any item to change quantity, move it, edit details, or remove it
- Changes sync live between phones; every add/use/move is logged in `events`
- Installable to the home screen; the last location you used is remembered for fast stock-takes

## One-time setup

### 1. Database (Supabase)
Already done if you ran it: paste `supabase/schema.sql` into **SQL Editor → New query → Run**.

The project URL and publishable key are in `src/supabase.js`. They're safe to commit; row-level security decides who sees what. Never commit the secret / service_role key.

### 2. Supabase sign-in settings
**Authentication → URL Configuration**: set **Site URL** to your GitHub Pages address (e.g. `https://<your-user>.github.io/home-inventory/`). That's where the confirmation email link sends people.

### 3. Put it on GitHub
```bash
git init
git add .
git commit -m "Home inventory prototype"
git branch -M main
git remote add origin https://github.com/<your-user>/home-inventory.git
git push -u origin main
```
Then in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Each push to `main` builds and publishes the site (about a minute). The URL appears in the Actions run and in Settings → Pages.

### 4. (Optional) Deploy the lookup function
The app already looks up the three Open Facts databases straight from the phone. Deploying the function adds UPCitemdb (better for razors, cleaning products and other non-food items) and a shared cache so each barcode is fetched online only once.
```bash
npm install -g supabase      # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref mtxcjawvrppgvthbileo
supabase functions deploy lookup
```

## Run locally
```bash
npm install
npm run dev -- --host
```
The camera needs HTTPS on a phone, so test scanning on the GitHub Pages URL. On your computer, `localhost` works.

## Using it
1. Create an account, confirm the email, sign in.
2. Create the household (keep “starter rooms” ticked), then adjust rooms in **Rooms**.
3. Your wife creates her own account and joins with the invite code from **Settings**.
4. Install to the home screen: iPhone → Safari → Share → Add to Home Screen. Android → Chrome → ⋮ → Install app.
5. Stock-take one room: pick its location once, then scan item after item.

## Project layout
```
src/
  App.jsx               sign-in → household → tabs
  supabase.js           client config
  lookup.js             barcode lookup waterfall (browser side)
  useInventory.js       data loading, realtime, add/adjust stock
  components/
    Auth.jsx, HouseholdSetup.jsx, Inventory.jsx, ItemSheet.jsx,
    ScanFlow.jsx, Scanner.jsx, Rooms.jsx, Settings.jsx, ...
supabase/
  schema.sql            tables, security policies, realtime
  functions/lookup/     Edge Function: lookup + shared cache
.github/workflows/deploy.yml   GitHub Pages build
```

## Next up (Phase 2)
Expiry dates and an “expiring soon” view, minimum quantities with a shopping list, history view with undo.

## Updates

### Phase 2a: barcode matching + product photos
Run `supabase/migrations/002_barcodes_and_photos.sql` once in the Supabase SQL Editor **before** using photos. It adds the `custom_image_url` column, the `product-images` storage bucket and its policies, and stores 12-digit UPC-A codes in 13-digit EAN form.

- Rescanning matches a saved product even if the code comes back as UPC-A, EAN-13 or with extra leading zeros.
- When a scan isn't recognised, **Already have this? Pick it from your items** saves the scanned code on an existing product.
- **Add photo / Change photo** on new products, the scan result and the item sheet. Your photo replaces the online image everywhere; **Use default** switches back.
