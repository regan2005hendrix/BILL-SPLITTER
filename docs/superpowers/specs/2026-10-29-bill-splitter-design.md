# Bill Splitter (Tabby / Divide) — System Design

**Date:** 2026-10-29  
**Status:** In Review  
**Design Register:** Hallmark *Cobalt* (Restrained Technical Modern-Minimal) + Impeccable Craft Floor

---

## 1. Intent and Why
Splitting restaurant bills and shared trip expenses among friends is notoriously frustrating. Existing tools either force everyone to download an app and create accounts (Splitwise), are bloated with ads, or cannot handle nuanced real-world dining scenarios like:
- One person not drinking alcohol or ordering a cheaper meal.
- Splitting an appetizer 3 ways instead of equally across all 8 people.
- Calculating tip and tax proportionally based on what each person actually ordered.
- Entering 15 items manually from a crinkled receipt instead of snapping a photo.
- Resolving complex debts across multiple trip expenses with minimal bank transfers.

This project builds an ultra-clean, zero-friction, privacy-first web application that solves both single-meal dining splits and multi-expense group trip ledgers, completely in the browser with zero accounts, zero trackers, and offline capability.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Dual Mode Operation**:
  1. *Quick Split*: Instant restaurant bill calculator with equal or itemized dish assignments, proportional tax/tip, and discount voucher deductions.
  2. *Group Ledger*: Multi-expense trip/roommate tracker with participant management, expense logs, and debt-minimizing settlement calculation ("who pays whom").
- **Optical Receipt Scanner (OCR)**: Camera snapshot or image upload processed entirely client-side via in-browser OCR (Tesseract.js) to extract line items and prices without sending images to external servers.
- **Quick-Paste Parser**: Fast fallback to paste raw text from digital receipts, SMS, or food delivery apps.
- **Unequal Shares**: Support splitting specific dishes by counts/shares (e.g., 2 slices vs 1 slice) or custom proportions.
- **One-Click Share & Payment**: Formatted copyable summaries for WhatsApp/iMessage and dynamic payment QR code generation (UPI / payment handles).
- **Anti-AI-Slop Hallmark Design**: Built to Hallmark's *Cobalt* theme: strict `:root` tokens, Familjen Grotesk + IBM Plex Sans typography, graphite surfaces, tactile keycaps with physical travel, hairlines, and full dark/light theme support.
- **Offline PWA**: Full Progressive Web App manifest and Service Worker caching so the tool functions in basements or offline venues.

### Non-Goals
- Cloud database user accounts or server-side authentication (all data is client-side in `localStorage`).
- Direct bank API integrations or processing credit card transactions directly (instead generates standard payment QR codes and deep links).

### Anti-Goals
- No generic AI slop: no purple-to-blue gradients, no cards inside cards, no hand-drawn emojis as icons, no floating decorative blobs, no layout shifts on button press, no untracked small-caps labels.
- No bulky build toolchains (no Node/npm dependencies required to run or edit the app).

---

## 3. Constraints
- **Zero-Build Requirement**: Must run natively by opening `index.html` in any browser and deploy cleanly to GitHub Pages without compiling.
- **Offline & Zero Cloud Dependencies**: Core calculations and data persistence must work offline with `localStorage`. External libraries (Tesseract.js for OCR, QRCode.js for QR) are loaded via reliable CDNs and cached by the Service Worker.
- **Hallmark The Floor**:
  - All colors and fonts declared at `:root` tokens.
  - No `transition: all`.
  - `overflow-x: clip` on `html` and `body`.
  - Focus-visible on all interactive elements.
  - `prefers-reduced-motion` compliance.

---

## 4. Approaches Considered

### Approach 1: Modular Modern Web App (Zero-Build, PWA-Ready) — *Selected*
- Clean separated files: `index.html`, `css/tokens.css`, `css/style.css`, `js/app.js`, `js/calculator.js`, `js/ocr.js`, `js/ledger.js`, `js/qr.js`, `manifest.json`, and `sw.js`.
- **Trade-offs**: Uses vanilla ES6 modules instead of React/JSX, which completely eliminates build steps, node_modules bloat, and deployment complexity.
- **Why Chosen**: Directly requested by the user. Matches the machine environment (no Node.js installed), offers instant preview, and delivers 100% browser speed with zero overhead.

### Approach 2: Bundled Vite + React Application
- Standard React single-page app with NPM dependencies.
- **Why Rejected**: Requires installing Node.js runtime and npm on the user's computer, building dist bundles before GitHub deployment, and adds hundreds of megabytes of `node_modules` for functionality cleanly handled by modern web standards.

---

## 5. Architectural Components & Detailed Behavior

### Component A: Mode 1 — Quick Split Calculator (`js/calculator.js`)
- **Inputs**:
  - Subtotal (computed automatically from items, or manually entered).
  - Tip: Quick selector buttons (0%, 10%, 15%, 18%, 20%, Custom %) with monetary equivalent display.
  - Tax: Percentage input with auto-calculated total tax.
  - Discount: Fixed amount ($) or percentage (%) deducted pre-tax/tip.
  - Currency selector: `$` (USD/CAD/AUD), `€` (EUR), `£` (GBP), `₹` (INR), `¥` (JPY/CNY), `CHF`, etc.
  - Rounding toggle: Exact cents vs Round Up to whole currency unit.
  - Payer designation: Select who paid the bill in full to generate their specific payment QR code.
- **Splitting Mechanics**:
  - *Equal Split*: Total divided by N people.
  - *Itemized Split*:
    - List of items with price and assigned people.
    - Support for unequal weights (e.g. Alice has 2 shares, Bob has 1 share).
    - Proportional distribution of shared items, discounts, tax, and tip:
      $$\text{Person Tax/Tip Share} = \text{Total Tax/Tip} \times \left(\frac{\text{Person Items Subtotal}}{\text{Total Items Subtotal}}\right)$$
  - *Output*:
    - Breakdown table per person with exact item breakdown, tax/tip contribution, and final owing amount.
    - One-click "Add to Group Trip": Direct bridge exporting the dining calculation as an expense into the active Group Ledger.
    - WhatsApp / Telegram formatted text generator:
      ```text
      🧾 Dinner at Osteria ($142.50)
      • Alice: $48.20 (Pasta, 2x Wine + tax/tip)
      • Bob: $52.10 (Steak, Beer + tax/tip)
      • Charlie: $42.20 (Risotto + tax/tip)
      Total: $142.50 | Settled via Tabby
      ```

### Component B: Bill OCR Scanner & Quick-Paste (`js/ocr.js`)
- **Camera / File Upload**:
  - Native `<input type="file" accept="image/*" capture="environment">` allowing instant mobile camera capture or photo upload.
  - In-browser image pre-processing on an off-screen HTML5 `<canvas>` (grayscale conversion, contrast enhancement, thresholding) to dramatically boost OCR accuracy on receipt text.
  - Tesseract.js worker running locally in the browser with progress indicator (0% to 100%).
- **Heuristic Line-Item Regex Parser**:
  - Detects lines ending in currency/numeric amounts (e.g., `Margherita Pizza 16.50`, `2x Draft Beer @ 7.00 ... 14.00`).
  - Ignores phone numbers, dates, card transaction numbers, and "TAX / SUB-TOTAL / TOTAL" lines.
  - Extracted items populate an interactive review table where users can edit prices, item names, or delete noise lines before confirming import into the bill.
- **Raw Text Quick-Paste**:
  - Textarea allowing users to paste receipt text copied from emails or delivery apps; runs the same heuristic parser immediately.

### Component C: Mode 2 — Group Trip / Roommate Ledger (`js/ledger.js`)
- **Multi-Group / Trip Management (Builder Call)**:
  - Users can create, name, and switch between multiple trips/groups (e.g., "Paris Vacation", "Apartment 4B").
  - Each group has an assigned base currency (simplifying calculations and preventing offline exchange-rate desync).
  - Stored in browser `localStorage` under structured JSON schemas.
- **Group Members & Payment Handles (Builder Call)**:
  - Add / remove group members with custom avatars and optional payment handles (UPI VPA, Venmo username, or phone number).
- **Expense Logging**:
  - Title (e.g., "Villa Rental", "Highway Tolls", "Groceries").
  - Amount and Date.
  - Paid by: Person from the group.
  - Split between: All members equally, or selected subset.
  - Split type: Equal, by exact amounts, or by custom percentages.
- **Debt Minimization Engine**:
  - Computes net balance for each member:
    $$\text{Balance}_i = \sum \text{Paid}_i - \sum \text{Owed}_i$$
  - Runs greedy debt settlement algorithm matching maximum creditor with maximum debtor to produce the minimal number of transactions required to settle the group completely:
    $$\min \text{transactions} \le N - 1$$
  - Renders an actionable "Settlement Plan": e.g., "Bob pays Alice $45.00", with a "Pay with QR" button that opens Alice's dynamic QR code instantly.

### Component D: Payment QR Generator (`js/qr.js`)
- Dynamic QR code generation using client-side QRCode library.
- Modes:
  1. **UPI Payment (India)**: Standard `upi://pay?pa={handle}&pn={name}&am={amount}&cu={currency}`.
  2. **Venmo / PayPal / Generic**: Deep links `https://venmo.com/?txn=pay&recipients={handle}&amount={amount}` or generic payment link display.
- Can be toggled open directly next to any person's owing summary so friends can scan and pay on the spot.

### Component E: Visual Design System & PWA (`css/tokens.css`, `css/style.css`, `sw.js`)
- **Hallmark *Cobalt* Tokens**:
  - Surfaces: Cool near-white `--color-paper` (`oklch(98.6% 0.005 250)`), graphite dark surfaces for code/numbers (`oklch(21% 0.024 262)`), and rich electric cobalt accent (`oklch(52% 0.19 258)`).
  - Typography: Familjen Grotesk for display and numerical figures, IBM Plex Sans for body, JetBrains Mono for monetary tabular data.
  - Tactile Controls: 3D keycaps with physical 3px travel on click (`:active { transform: translateY(3px); }`).
  - Dark Mode: Full automatic and toggleable dark theme using inverted graphite/slate palettes with high-contrast readability for dimly lit dining spaces.
- **PWA Capabilities**:
  - `manifest.json` for installation as a standalone app on iOS and Android.
  - `sw.js` cache-first service worker for complete offline reliability.

---

## 6. Settled Builder Calls
1. **Multi-Currency Policy**: Each Group Ledger operates in its own selected base currency to maintain mathematical consistency without relying on an external live FX server.
2. **Payment Handle Storage**: Quick Split allows setting a payer handle in a lightweight drawer; Group Ledger stores optional handles per member so clicking "Pay Alice" in settlement immediately displays Alice's QR code.
3. **Multi-Trip Support**: Implemented a trip/group switcher so users can keep separate ledgers for different vacations and housemates without overwriting data.
4. **Quick Split to Ledger Bridge**: Added an "Add to Group Trip" action in Quick Split that exports the calculated meal breakdown directly as an expense into any active trip ledger.


