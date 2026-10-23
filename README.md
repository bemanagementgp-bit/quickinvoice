# QuickInvoice – Free Invoice Generator

A pure static, privacy-first invoice generator. Fill in your business and client details, add line items, and download a professional PDF invoice (via the browser print dialog). Everything runs in the browser – no account, no server, no data upload.

**Live URL:** https://__SITE_URL__ (placeholder – replace after deploy)

## Features

- Business + client details, optional logo upload (stored locally as a data URL)
- Auto-incrementing invoice numbers (`INV-0001`, `INV-0002`, …)
- Issue date (today) and due date (+14 days) defaults
- 10 currencies formatted with `Intl.NumberFormat` (USD, EUR, GBP, CAD, AUD, MXN, BRL, ARS, INR, JPY)
- Line items with qty × unit price, tax %, discount (% or fixed), shipping, notes / payment terms
- Live invoice preview with accent color picker – the preview is exactly what prints
- Download PDF / Print via `window.print()` with dedicated A4/Letter print CSS
- Copy share text (plain-text summary for email or chat)
- Autosave to `localStorage`, restore on reload, realistic sample data on first visit
- Save invoices to a local history (reload / delete)
- Dark + light theme

### Pro (one-time, lifetime)

- Removes the "Generated with QuickInvoice" line on printed invoices
- Unlimited saved invoices (free: 3)
- 3 templates: Classic (free), Modern and Minimal (Pro)
- Lifetime updates

Gating lives in `app.js` and uses `isPro()` from `monetize.js`.

## Monetization setup

All switches live in `config.js`:

1. **Google AdSense** – set `ADSENSE_CLIENT` to your publisher id (e.g. `ca-pub-1234567890123456`). The `.ad-slot` placeholders become real ad units automatically. Leave empty to show dashed placeholders.
2. **Pro checkout** – create a product on Lemon Squeezy, Gumroad or a Stripe Payment Link and paste the URL in `PRO_CHECKOUT_URL`. Set `PRO_PRICE` to the displayed price. After purchase the buyer pastes the license key from the email into the Pro modal (`activateLicense` in `monetize.js` – replace with real license validation, e.g. the Lemon Squeezy license API, before going live).
3. **Google Analytics** – set `GA_ID` (e.g. `G-XXXXXXX`). `track()` events fired: `generate`, `download`, `print`, `copy`, `save_invoice`, `pro_click`, `begin_checkout`.
4. **Site URL** – after the first deploy, replace the literal `__SITE_URL__` in every file with your domain:
   `grep -rl "__SITE_URL__" . | xargs sed -i 's/__SITE_URL__/yourdomain.com/g'`

## Run locally

```bash
npx serve .
```

Then open the printed URL (usually http://localhost:3000). No build step, no dependencies.

## Deploy

Deploy the folder as-is to Vercel (`vercel.json` enables clean URLs so `/privacy` and `/terms` resolve).
