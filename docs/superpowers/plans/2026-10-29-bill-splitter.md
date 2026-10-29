# Bill Splitter (Tabby / Divide) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an anti-AI-slop, zero-build, offline-capable bill splitting and group expense ledger web app with client-side OCR receipt scanning, debt minimization, and dynamic payment QR codes.

**Architecture:** Modular vanilla ES6 modules with clean separation of concerns (`calculator.js`, `ocr.js`, `ledger.js`, `qr.js`, `app.js`). Zero build step (native browser execution), styled with Hallmark *Cobalt* tokens and tactile keycaps, offline PWA with service worker.

**Tech Stack:** HTML5, CSS3 (OKLCH color space, CSS tokens, `:focus-visible`, reduced-motion), Modern JavaScript (ES6+), Tesseract.js (client OCR via CDN), QRCode.js (via CDN), Service Worker API, LocalStorage API.

**Spec:** [docs/superpowers/specs/2026-10-29-bill-splitter-design.md](file:///c:/Users/Regan%20Hendriques/BILL-SPLITTER/docs/superpowers/specs/2026-10-29-bill-splitter-design.md)

## Global Constraints
- Zero-build requirement: runs natively in any browser with zero node/npm dependencies.
- Hallmark The Floor:
  - Every color and font goes through a token declared at `:root`.
  - Never `transition: all`. Never animate `width`, `height`, `top`, or `left`.
  - `overflow-x: clip` on `html` and `body`.
  - Interactive elements have instant `:focus-visible`.
  - All animations provide `prefers-reduced-motion` fallbacks.
  - No purple-to-blue gradients, no cards inside cards, no fake badges, no untracked small caps.
- Strict client-side privacy: Receipt OCR and group financial data never leave the user's browser.

## Review Focus
1. **Unequal Dish Split Zero-Share Division**: When splitting an item among participants, if a participant's assigned weight is zero or total weight is zero, calculate without throwing `NaN` or `Infinity`.
2. **Proportional Discount Exceeding Subtotal**: When a discount voucher is greater than the total subtotal, clamp total to zero rather than yielding negative owes.
3. **Receipt OCR Garbled Noise**: Low-contrast receipt photos produce unstructured text lines without prices; the regex parser must safely filter noise and preserve only valid item-price candidates.
4. **Greedy Debt Minimization Floating-Point Residuals**: Rounding fractions of cents across complex multi-creditor debts can leave lingering ±$0.01 balances; the debt engine must re-center remainders onto the largest balance to ensure net zero.
5. **Offline CDN Fallbacks**: If internet drops before CDN libraries (Tesseract.js / QRCode.js) load, the app must gracefully inform the user rather than crashing the calculator.

---

### Task 1: Project Scaffolding, Hallmark Cobalt Design System & Tokens

**Files:**
- Create: `index.html`
- Create: `css/tokens.css`
- Create: `css/style.css`
- Create: `manifest.json`
- Create: `sw.js`

**Interfaces:**
- Produces: Base HTML layout with app header, tab switcher (`Quick Split` vs `Group Ledger`), theme toggle, and container elements for calculator, ledger, scanner modal, and QR modal.
- Produces: Full Hallmark Cobalt design tokens, keycap button styles (`.key`, `.key--primary`), input styles (`.cut`), hairline rules (`.rule`), and typography scale.

- [ ] **Step 1: Create `css/tokens.css` with Hallmark Cobalt token suite**
Declare `--color-paper`, `--color-ink`, `--color-accent`, `--font-display` ("Familjen Grotesk"), `--font-body` ("IBM Plex Sans"), `--font-outlier` ("JetBrains Mono"), `--shadow-key`, `--shadow-key-press`, and light/dark theme overrides.

- [ ] **Step 2: Create `css/style.css` with layout, responsive grid, and control styles**
Implement `:focus-visible`, button keycaps with 3px press travel (`translateY(3px)`), hair-thin borders (`oklch(...)`), card layout, and `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 3: Create `manifest.json` and `sw.js` for Progressive Web App**
Configure offline caching for HTML, CSS, JS, and CDN assets so the site can be installed on mobile home screens.

- [ ] **Step 4: Create `index.html` with semantic structure**
Header with mode switcher tabs, theme toggle, and view panels: `#view-quick-split` and `#view-group-ledger`.

- [ ] **Step 5: Verify in browser**
Open `index.html` in browser; verify Cobalt typography, responsive container, tab switches, and keycap button press animations.

- [ ] **Step 6: Commit**
```bash
git add index.html css/ manifest.json sw.js
git commit -m "feat: scaffold hallmark cobalt layout and design tokens"
```

---

### Task 2: Quick Split Engine & Calculation Logic (`js/calculator.js`)

**Files:**
- Create: `js/calculator.js`
- Create: `tests/test-calculator.js`

**Interfaces:**
- Produces: `calculateEqualSplit({ subtotal, tipPercent, taxPercent, discountType, discountValue, peopleCount, roundUp })`
- Produces: `calculateItemizedSplit({ items, people, tipPercent, taxPercent, discountType, discountValue, roundUp })`
- Produces: `formatWhatsAppSummary({ title, currency, results, total })`

- [ ] **Step 1: Write test suite in `tests/test-calculator.js`**
Test equal split with tip/tax, test itemized split with proportional tip/tax, test discount deduction pre-tax, test zero-share edge cases, and test rounding.

- [ ] **Step 2: Run test suite**
Run: `powershell -Command "node tests/test-calculator.js"` (or open browser test harness `tests/index.html`). Verify failure before implementation.

- [ ] **Step 3: Implement `js/calculator.js`**
Write mathematical functions:
- Proportional itemized distribution: each person's tax/tip is strictly proportional to their items subtotal.
- Support both fixed ($) and percentage (%) discounts.
- Currency formatting for `$` (USD), `€` (EUR), `£` (GBP), `₹` (INR), `¥` (JPY).
- Clean copyable WhatsApp/Telegram text formatter.

- [ ] **Step 4: Verify test suite passes**
Expected: All math and rounding test cases pass.

- [ ] **Step 5: Commit**
```bash
git add js/calculator.js tests/test-calculator.js
git commit -m "feat: implement quick split calculation engine and tests"
```

---

### Task 3: Bill OCR Scanner & Quick-Paste Parsing (`js/ocr.js`)

**Files:**
- Create: `js/ocr.js`
- Create: `tests/test-ocr-parser.js`

**Interfaces:**
- Consumes: User image file or camera snapshot, raw text pasted.
- Produces: `parseReceiptText(rawText: string) -> Array<{ name: string, price: number }>`
- Produces: `processReceiptImage(imageFile, progressCallback) -> Promise<string>`

- [ ] **Step 1: Write unit tests for regex parser in `tests/test-ocr-parser.js`**
Test extracting names and prices from standard restaurant receipts, delivery receipts, prices with currency symbols, and filtering noise lines (dates, tax, totals).

- [ ] **Step 2: Run test to verify failure**
Run test script; verify test fails.

- [ ] **Step 3: Implement `parseReceiptText` in `js/ocr.js`**
Regex heuristic matcher that identifies line items, quantity multipliers (e.g. `2x Beer 14.00`), cleans OCR artifacts, and extracts item names and numeric prices.

- [ ] **Step 4: Implement `processReceiptImage` with Canvas pre-processing & Tesseract.js**
- Draw input image to an off-screen `<canvas>`.
- Convert to grayscale, apply contrast stretching / thresholding to maximize OCR character clarity.
- Initialize Tesseract.js worker with progress callback for the UI progress bar.

- [ ] **Step 5: Verify parser test passes**
Expected: Regex parser successfully extracts line items from sample receipt text.

- [ ] **Step 6: Commit**
```bash
git add js/ocr.js tests/test-ocr-parser.js
git commit -m "feat: implement bill OCR scanner and quick-paste parser"
```

---

### Task 4: Group Trip / Roommate Ledger & Debt Minimization (`js/ledger.js`)

**Files:**
- Create: `js/ledger.js`
- Create: `tests/test-ledger.js`

**Interfaces:**
- Produces: `createTrip({ name, currency })`
- Produces: `addExpense({ tripId, title, amount, paidBy, splitBetween, splitType, customShares })`
- Produces: `calculateSettlements(tripId) -> Array<{ from: string, to: string, amount: number }>`
- Produces: `exportQuickSplitToTrip(tripId, quickSplitResult)`

- [ ] **Step 1: Write tests for debt minimization algorithm in `tests/test-ledger.js`**
Test 3-person cyclic debts (A owes B, B owes C -> A pays C), multi-payer expenses, unequal splits, and zero-sum verification.

- [ ] **Step 2: Run test to verify failure**
Verify algorithm test fails before implementation.

- [ ] **Step 3: Implement Greedy Debt Minimization algorithm in `js/ledger.js`**
1. Compute net balance for every member: $\sum \text{Paid} - \sum \text{Owed}$.
2. Separate into list of Creditors ($>0$) and Debtors ($<0$).
3. Match maximum debtor with maximum creditor, transfer $\min(|\text{Debtor}|, \text{Creditor})$, and iterate until all balances are zero.
4. Return minimum transaction list: `{ from, to, amount }`.

- [ ] **Step 4: Implement Multi-Trip storage and Quick Split import bridge**
CRUD for named trips in `localStorage`, member management, expense history, and bridge function to import a meal bill directly from Quick Split.

- [ ] **Step 5: Verify test passes**
Expected: Debt settlement produces minimal transactions with net zero residual.

- [ ] **Step 6: Commit**
```bash
git add js/ledger.js tests/test-ledger.js
git commit -m "feat: implement group trip ledger and debt minimization engine"
```

---

### Task 5: Dynamic Payment QR Code Generator (`js/qr.js`)

**Files:**
- Create: `js/qr.js`

**Interfaces:**
- Produces: `renderUPIQRCode(containerElement, { vpa, name, amount, currency, note })`
- Produces: `generatePaymentLink({ method, handle, amount, currency, note })`

- [ ] **Step 1: Implement URI formatters in `js/qr.js`**
- UPI URI format: `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=${currency}&tn=${encodeURIComponent(note)}`
- Venmo deep link: `https://venmo.com/?txn=pay&recipients=${handle}&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`
- PayPal.me link: `https://paypal.me/${handle}/${amount.toFixed(2)}`

- [ ] **Step 2: Implement dynamic QR render using QRCode.js**
Render QR code into an interactive modal with a copy link button and clean payment instruction.

- [ ] **Step 3: Verify QR generation in browser**
Test rendering QR code with test handles; verify scanner app parses payment parameters accurately.

- [ ] **Step 4: Commit**
```bash
git add js/qr.js
git commit -m "feat: implement dynamic payment QR generator"
```

---

### Task 6: Application Assembly, Interactive UI Wiring, Demo Data & Verification

**Files:**
- Create: `js/app.js`
- Modify: `index.html`
- Create: `tests/test-runner.html`

**Interfaces:**
- Integrates all components into a fluid single-page experience.

- [ ] **Step 1: Wire up Quick Split UI in `js/app.js`**
Connect inputs for subtotal, tip presets, tax, and discount. Wire up items table with person assignment chips. Render real-time breakdown cards.

- [ ] **Step 2: Wire up OCR Scanner & Quick-Paste Modal**
Camera button opens image picker / modal; show processing spinner; render extracted line items into an editable table with "Import to Bill" button.

- [ ] **Step 3: Wire up Group Ledger UI in `js/app.js`**
Trip switcher dropdown, "New Trip" modal, add member chips, add expense modal, and live "Who Owes Whom" settlement cards with "Pay with QR" buttons.

- [ ] **Step 4: Add Sample Demo Data**
Add "Load Sample Dinner" and "Load Sample Trip" buttons so users can test all features with one click on first visit.

- [ ] **Step 5: Implement in-browser test runner (`tests/test-runner.html`)**
Create a standalone visual test harness running all unit tests right in the browser with pass/fail badges.

- [ ] **Step 6: End-to-end verification**
Verify camera OCR, text paste, equal/itemized split calculations, debt minimization, QR generation, PWA offline caching, and dark/light mode toggle.

- [ ] **Step 7: Final Commit**
```bash
git add js/app.js index.html tests/
git commit -m "feat: complete bill splitter website with hallmark cobalt design"
```

