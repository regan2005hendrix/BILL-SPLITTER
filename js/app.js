/**
 * Tabby — Main Application Controller & UI Wiring
 * Connects calculator, OCR scanner, ledger, QR codes, and Hallmark Cobalt styling.
 */

import {
  calculateEqualSplit,
  calculateItemizedSplit,
  formatWhatsAppSummary,
  roundAmount
} from './calculator.js';

import {
  parseReceiptText,
  processReceiptImage
} from './ocr.js';

import {
  getAllTrips,
  getActiveTrip,
  getActiveTripId,
  setActiveTripId,
  createTrip,
  addMemberToTrip,
  addExpenseToTrip,
  deleteExpenseFromTrip,
  resetTripExpenses,
  calculateNetBalances,
  calculateSettlements,
  formatTripSummary,
  exportQuickSplitToTrip
} from './ledger.js';

import {
  renderPaymentQRCode,
  generatePaymentURI
} from './qr.js';

/* ==========================================================================
   State Management
   ========================================================================== */

const quickState = {
  currency: '$',
  splitStyle: 'itemized',
  people: ['Alice', 'Bob', 'Charlie'],
  items: [
    { id: '1', name: 'Margherita Pizza', price: 16.50, sharedBy: ['Alice', 'Bob'] },
    { id: '2', name: 'Truffle Pasta', price: 22.00, sharedBy: ['Charlie'] },
    { id: '3', name: 'Craft Beer (2x)', price: 14.00, sharedBy: ['Alice', 'Bob'] },
    { id: '4', name: 'Tiramisu', price: 8.50, sharedBy: ['Alice', 'Bob', 'Charlie'] }
  ],
  tipPercent: 15,
  taxPercent: 8.0,
  discountValue: 0,
  rounding: 'exact',
  payerName: '',
  payerHandle: ''
};

// Temp store for scanned OCR review items
let ocrDetectedItems = [];
let currentPaymentURI = '';

/* ==========================================================================
   DOM Elements
   ========================================================================== */

const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const modeTabBtns = document.querySelectorAll('.tab-btn');
const viewQuickSplit = document.getElementById('view-quick-split');
const viewGroupLedger = document.getElementById('view-group-ledger');
const toastEl = document.getElementById('toast');

// Quick Split Elements
const currencySelect = document.getElementById('currency-select');
const splitStyleSelect = document.getElementById('split-style-select');
const equalSplitControls = document.getElementById('equal-split-controls');
const itemizedSplitControls = document.getElementById('itemized-split-controls');
const equalSubtotalInput = document.getElementById('equal-subtotal');
const equalPeopleCountInput = document.getElementById('equal-people-count');
const quickPeopleChips = document.getElementById('quick-people-chips');
const newPersonInput = document.getElementById('new-person-name');
const btnAddPerson = document.getElementById('btn-add-person');
const dishesTbody = document.getElementById('dishes-tbody');
const newDishNameInput = document.getElementById('new-dish-name');
const newDishPriceInput = document.getElementById('new-dish-price');
const btnAddDish = document.getElementById('btn-add-dish');
const tipPresetBtns = document.querySelectorAll('#tip-presets .chip-btn');
const customTipInput = document.getElementById('custom-tip-input');
const taxPercentInput = document.getElementById('tax-percent');
const discountInput = document.getElementById('discount-input');
const roundingSelect = document.getElementById('rounding-select');
const quickPayerSelect = document.getElementById('quick-payer-select');
const quickPayerHandleInput = document.getElementById('quick-payer-handle');

// Quick Split Summary Elements
const summarySubtotal = document.getElementById('summary-subtotal');
const summaryDiscount = document.getElementById('summary-discount');
const rowDiscount = document.getElementById('row-discount');
const summaryTaxRate = document.getElementById('summary-tax-rate');
const summaryTax = document.getElementById('summary-tax');
const summaryTipRate = document.getElementById('summary-tip-rate');
const summaryTip = document.getElementById('summary-tip');
const summaryTotal = document.getElementById('summary-total');
const personBreakdownList = document.getElementById('person-breakdown-list');
const btnCopySummary = document.getElementById('btn-copy-summary');
const btnShowBillQR = document.getElementById('btn-show-bill-qr');
const btnLoadSampleBill = document.getElementById('btn-load-sample-bill');
const btnExportToTrip = document.getElementById('btn-export-to-trip');

// OCR & Paste Modal Elements
const btnOpenScanner = document.getElementById('btn-open-scanner');
const modalOcr = document.getElementById('modal-ocr');
const ocrFileInput = document.getElementById('ocr-file-input');
const ocrProgressContainer = document.getElementById('ocr-progress-container');
const ocrProgressLabel = document.getElementById('ocr-progress-label');
const ocrProgressBar = document.getElementById('ocr-progress-bar');
const ocrResultsContainer = document.getElementById('ocr-results-container');
const ocrTbody = document.getElementById('ocr-tbody');
const btnImportOcrItems = document.getElementById('btn-import-ocr-items');
const btnOpenPasteModal = document.getElementById('btn-open-paste-modal');
const modalPaste = document.getElementById('modal-paste');
const rawReceiptTextarea = document.getElementById('raw-receipt-textarea');
const btnParsePastedText = document.getElementById('btn-parse-pasted-text');

// Group Ledger Elements
const tripSelector = document.getElementById('trip-selector');
const btnNewTrip = document.getElementById('btn-new-trip');
const btnLoadSampleTrip = document.getElementById('btn-load-sample-trip');
const btnResetTrip = document.getElementById('btn-reset-trip');
const tripMembersList = document.getElementById('trip-members-list');
const newTripMemberName = document.getElementById('new-trip-member-name');
const newTripMemberHandle = document.getElementById('new-trip-member-handle');
const btnAddTripMember = document.getElementById('btn-add-trip-member');
const btnOpenAddExpense = document.getElementById('btn-open-add-expense');
const tripExpensesTable = document.getElementById('trip-expenses-table');
const tripExpensesTbody = document.getElementById('trip-expenses-tbody');
const tripExpensesEmpty = document.getElementById('trip-expenses-empty');
const tripTotalSpend = document.getElementById('trip-total-spend');
const tripExpenseCount = document.getElementById('trip-expense-count');
const tripBalancesList = document.getElementById('trip-balances-list');
const tripSettlementList = document.getElementById('trip-settlement-list');
const btnCopyTripSummary = document.getElementById('btn-copy-trip-summary');

// Modals: Expense, Trip & QR
const modalAddExpense = document.getElementById('modal-add-expense');
const formAddExpense = document.getElementById('form-add-expense');
const expenseTitleInput = document.getElementById('expense-title');
const expenseAmountInput = document.getElementById('expense-amount');
const expensePayerSelect = document.getElementById('expense-payer');
const expenseSplitMembers = document.getElementById('expense-split-members');

const modalNewTrip = document.getElementById('modal-new-trip');
const formNewTrip = document.getElementById('form-new-trip');
const newTripNameInput = document.getElementById('new-trip-name');
const newTripCurrencySelect = document.getElementById('new-trip-currency');

const modalQr = document.getElementById('modal-qr');
const qrCodeDisplay = document.getElementById('qr-code-display');
const qrAmountDisplay = document.getElementById('qr-amount-display');
const qrHandleDisplay = document.getElementById('qr-handle-display');
const btnCopyPaymentLink = document.getElementById('btn-copy-payment-link');

/* ==========================================================================
   Theme Management
   ========================================================================== */

function initTheme() {
  const saved = localStorage.getItem('tabby_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;

  applyTheme(isDark);
  themeToggleBtn.addEventListener('click', () => {
    const currentlyDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(!currentlyDark);
  });
}

function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeIcon.textContent = '☀️';
    localStorage.setItem('tabby_theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeIcon.textContent = '🌙';
    localStorage.setItem('tabby_theme', 'light');
  }
}

/* ==========================================================================
   Toast Helper
   ========================================================================== */

let toastTimeout;
function showToast(message) {
  clearTimeout(toastTimeout);
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2600);
}

/* ==========================================================================
   Modal Helpers
   ========================================================================== */

function setupModalClosers() {
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-backdrop');
      if (modal) modal.classList.remove('open');
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });
}

/* ==========================================================================
   Navigation Tabs
   ========================================================================== */

function initTabs() {
  modeTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      modeTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (targetTab === 'quick-split') {
        viewQuickSplit.classList.add('active');
        viewGroupLedger.classList.remove('active');
        renderQuickSplit();
      } else {
        viewQuickSplit.classList.remove('active');
        viewGroupLedger.classList.add('active');
        renderGroupLedger();
      }
    });
  });
}

/* ==========================================================================
   Quick Split Controller & View
   ========================================================================== */

function initQuickSplit() {
  currencySelect.addEventListener('change', (e) => {
    quickState.currency = e.target.value;
    renderQuickSplit();
  });

  splitStyleSelect.addEventListener('change', (e) => {
    quickState.splitStyle = e.target.value;
    if (quickState.splitStyle === 'equal') {
      equalSplitControls.style.display = 'block';
      itemizedSplitControls.style.display = 'none';
    } else {
      equalSplitControls.style.display = 'none';
      itemizedSplitControls.style.display = 'block';
    }
    renderQuickSplit();
  });

  equalSubtotalInput.addEventListener('input', () => renderQuickSplit());
  equalPeopleCountInput.addEventListener('input', () => renderQuickSplit());

  taxPercentInput.addEventListener('input', (e) => {
    quickState.taxPercent = parseFloat(e.target.value) || 0;
    renderQuickSplit();
  });

  discountInput.addEventListener('input', (e) => {
    quickState.discountValue = parseFloat(e.target.value) || 0;
    renderQuickSplit();
  });

  roundingSelect.addEventListener('change', (e) => {
    quickState.rounding = e.target.value;
    renderQuickSplit();
  });

  quickPayerHandleInput.addEventListener('input', (e) => {
    quickState.payerHandle = e.target.value.trim();
  });

  // Tip presets
  tipPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tipPresetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      customTipInput.value = '';
      quickState.tipPercent = parseFloat(btn.getAttribute('data-tip')) || 0;
      renderQuickSplit();
    });
  });

  customTipInput.addEventListener('input', (e) => {
    tipPresetBtns.forEach(b => b.classList.remove('active'));
    quickState.tipPercent = parseFloat(e.target.value) || 0;
    renderQuickSplit();
  });

  // Add person
  btnAddPerson.addEventListener('click', addPersonToQuickSplit);
  newPersonInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPersonToQuickSplit();
    }
  });

  // Add dish
  btnAddDish.addEventListener('click', addDishToQuickSplit);
  newDishPriceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDishToQuickSplit();
    }
  });

  // Copy Summary
  btnCopySummary.addEventListener('click', () => {
    const calculation = getQuickCalculation();
    const text = formatWhatsAppSummary({
      title: 'Dinner Bill',
      currency: quickState.currency,
      results: calculation
    });
    navigator.clipboard.writeText(text).then(() => {
      showToast('Summary copied to clipboard!');
    }).catch(() => {
      showToast('Failed to copy');
    });
  });

  // Show Payment QR
  btnShowBillQR.addEventListener('click', () => {
    const calculation = getQuickCalculation();
    openPaymentQRModal({
      name: quickState.payerName || 'Host',
      handle: quickState.payerHandle || 'dinner@upi',
      amount: calculation.total,
      currency: quickState.currency,
      note: 'Dinner Bill Total'
    });
  });

  // Sample Dinner
  btnLoadSampleBill.addEventListener('click', loadSampleDinner);

  // Export to Trip
  btnExportToTrip.addEventListener('click', exportMealToActiveTrip);

  renderQuickSplit();
}

function addPersonToQuickSplit() {
  const name = newPersonInput.value.trim();
  if (!name) return;

  if (!quickState.people.includes(name)) {
    quickState.people.push(name);
    newPersonInput.value = '';
    renderQuickSplit();
  }
}

function removePersonFromQuickSplit(name) {
  if (quickState.people.length <= 1) {
    showToast('At least one person required.');
    return;
  }
  quickState.people = quickState.people.filter(p => p !== name);
  // Remove from items sharedBy
  quickState.items.forEach(item => {
    item.sharedBy = item.sharedBy.filter(p => p !== name);
  });
  renderQuickSplit();
}

function addDishToQuickSplit() {
  const name = newDishNameInput.value.trim() || 'Food Item';
  const price = parseFloat(newDishPriceInput.value) || 0;
  if (price <= 0) {
    showToast('Please enter a valid price.');
    return;
  }

  quickState.items.push({
    id: 'dish_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3),
    name,
    price,
    sharedBy: [...quickState.people] // default shared by all current people
  });

  newDishNameInput.value = '';
  newDishPriceInput.value = '';
  newDishNameInput.focus();
  renderQuickSplit();
}

function deleteDish(id) {
  quickState.items = quickState.items.filter(i => i.id !== id);
  renderQuickSplit();
}

function togglePersonOnDish(dishId, personName) {
  const dish = quickState.items.find(i => i.id === dishId);
  if (!dish) return;

  if (dish.sharedBy.includes(personName)) {
    if (dish.sharedBy.length > 1) {
      dish.sharedBy = dish.sharedBy.filter(p => p !== personName);
    } else {
      showToast('At least one person must share this item.');
      return;
    }
  } else {
    dish.sharedBy.push(personName);
  }
  renderQuickSplit();
}

function getQuickCalculation() {
  if (quickState.splitStyle === 'equal') {
    return calculateEqualSplit({
      subtotal: parseFloat(equalSubtotalInput.value) || 0,
      tipPercent: quickState.tipPercent,
      taxPercent: quickState.taxPercent,
      discountValue: quickState.discountValue,
      peopleCount: parseInt(equalPeopleCountInput.value, 10) || 1,
      rounding: quickState.rounding
    });
  } else {
    return calculateItemizedSplit({
      items: quickState.items,
      people: quickState.people,
      tipPercent: quickState.tipPercent,
      taxPercent: quickState.taxPercent,
      discountValue: quickState.discountValue,
      rounding: quickState.rounding
    });
  }
}

function renderQuickSplit() {
  const cur = quickState.currency;

  // 1. Render People Chips
  quickPeopleChips.innerHTML = '';
  quickState.people.forEach(person => {
    const chip = document.createElement('div');
    chip.className = 'chip-btn active';
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '6px';
    chip.innerHTML = `
      <span>${person}</span>
      <span style="cursor: pointer; opacity: 0.6; font-size: 11px;" title="Remove person">✕</span>
    `;
    chip.querySelector('span:last-child').addEventListener('click', (e) => {
      e.stopPropagation();
      removePersonFromQuickSplit(person);
    });
    quickPeopleChips.appendChild(chip);
  });

  // 2. Render Payer Selector
  quickPayerSelect.innerHTML = '<option value="">I paid (Device Owner)</option>';
  quickState.people.forEach(person => {
    const opt = document.createElement('option');
    opt.value = person;
    opt.textContent = `${person} paid in full`;
    if (quickState.payerName === person) opt.selected = true;
    quickPayerSelect.appendChild(opt);
  });
  quickPayerSelect.onchange = (e) => {
    quickState.payerName = e.target.value;
  };

  // 3. Render Dishes Table
  dishesTbody.innerHTML = '';
  if (quickState.items.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" style="text-align: center; color: var(--color-muted); padding: var(--space-md);">No dishes added. Add items or scan a receipt!</td>`;
    dishesTbody.appendChild(tr);
  } else {
    quickState.items.forEach(item => {
      const tr = document.createElement('tr');

      // Member chips for this dish
      const memberChipsHtml = quickState.people.map(person => {
        const isShared = item.sharedBy.includes(person);
        const activeClass = isShared ? 'active' : '';
        return `<button type="button" class="chip-btn ${activeClass}" style="padding: 2px 7px; font-size: 11px;" data-person="${person}">${person}</button>`;
      }).join(' ');

      tr.innerHTML = `
        <td style="font-weight: 500;">${item.name}</td>
        <td class="mono">${cur}${item.price.toFixed(2)}</td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${memberChipsHtml}
          </div>
        </td>
        <td style="text-align: right;">
          <button class="key key--sm key--danger" type="button" style="padding: 2px 6px; min-height: 24px;" title="Delete item">✕</button>
        </td>
      `;

      // Event listeners for member chips on dish
      tr.querySelectorAll('button[data-person]').forEach(btn => {
        btn.addEventListener('click', () => {
          togglePersonOnDish(item.id, btn.getAttribute('data-person'));
        });
      });

      // Delete button
      tr.querySelector('.key--danger').addEventListener('click', () => {
        deleteDish(item.id);
      });

      dishesTbody.appendChild(tr);
    });
  }

  // 4. Compute and Render Summary
  const calc = getQuickCalculation();

  summarySubtotal.textContent = `${cur}${calc.subtotal.toFixed(2)}`;
  if (calc.discount > 0) {
    rowDiscount.style.display = 'flex';
    summaryDiscount.textContent = `- ${cur}${calc.discount.toFixed(2)}`;
  } else {
    rowDiscount.style.display = 'none';
  }

  summaryTaxRate.textContent = `${quickState.taxPercent}%`;
  summaryTax.textContent = `${cur}${calc.tax.toFixed(2)}`;
  summaryTipRate.textContent = `${quickState.tipPercent}%`;
  summaryTip.textContent = `${cur}${calc.tip.toFixed(2)}`;
  summaryTotal.textContent = `${cur}${calc.total.toFixed(2)}`;

  // 5. Render Individual Person Breakdown Cards
  personBreakdownList.innerHTML = '';
  if (calc.breakdown && calc.breakdown.length > 0) {
    calc.breakdown.forEach(p => {
      const card = document.createElement('div');
      card.className = 'person-share-card';
      card.innerHTML = `
        <div class="person-share-header">
          <span class="person-name">${p.person}</span>
          <span class="person-total mono">${cur}${p.total.toFixed(2)}</span>
        </div>
        <div class="person-items-list">
          <div>${p.itemsSummary}</div>
          <div style="margin-top: 4px; opacity: 0.8;">Items: ${cur}${p.itemsTotal.toFixed(2)} | Tax/Tip share: ${cur}${(p.tax + p.tip).toFixed(2)}</div>
        </div>
      `;
      personBreakdownList.appendChild(card);
    });
  } else if (calc.perPerson) {
    const card = document.createElement('div');
    card.className = 'person-share-card';
    card.innerHTML = `
      <div class="person-share-header">
        <span class="person-name">Each Person (${calc.peopleCount} people)</span>
        <span class="person-total mono">${cur}${calc.perPerson.toFixed(2)}</span>
      </div>
      <div class="person-items-list">Equal split of total bill including tip & tax.</div>
    `;
    personBreakdownList.appendChild(card);
  }
}

function loadSampleDinner() {
  quickState.currency = '$';
  currencySelect.value = '$';
  quickState.splitStyle = 'itemized';
  splitStyleSelect.value = 'itemized';
  equalSplitControls.style.display = 'none';
  itemizedSplitControls.style.display = 'block';

  quickState.people = ['Alice', 'Bob', 'Charlie', 'David'];
  quickState.items = [
    { id: '1', name: 'Margherita Pizza', price: 18.00, sharedBy: ['Alice', 'Bob'] },
    { id: '2', name: 'Truffle Tagliatelle', price: 24.00, sharedBy: ['Charlie'] },
    { id: '3', name: 'Prime Ribeye Steak', price: 34.00, sharedBy: ['David'] },
    { id: '4', name: 'Chianti Classico (Bottle)', price: 38.00, sharedBy: ['Alice', 'Bob', 'David'] },
    { id: '5', name: 'Tiramisu Della Casa', price: 12.00, sharedBy: ['Alice', 'Bob', 'Charlie', 'David'] }
  ];
  quickState.tipPercent = 18;
  tipPresetBtns.forEach(b => b.classList.remove('active'));
  document.querySelector('#tip-presets .chip-btn[data-tip="18"]')?.classList.add('active');

  quickState.taxPercent = 8.5;
  taxPercentInput.value = '8.5';
  quickState.discountValue = 0;
  discountInput.value = '0';
  quickState.payerName = 'Alice';
  quickState.payerHandle = 'alice@upi';
  quickPayerHandleInput.value = 'alice@upi';

  renderQuickSplit();
  showToast('Loaded sample Italian dinner bill!');
}

function exportMealToActiveTrip() {
  const calc = getQuickCalculation();
  const trip = getActiveTrip();
  if (!trip) {
    showToast('No active trip found in Group Ledger.');
    return;
  }

  exportQuickSplitToTrip(trip.id, calc, 'Dinner at Osteria');
  showToast(`Exported ${quickState.currency}${calc.total.toFixed(2)} to trip "${trip.name}"!`);
}

/* ==========================================================================
   OCR Scanner & Raw Paste Controller
   ========================================================================== */

function initOcrAndPaste() {
  btnOpenScanner.addEventListener('click', () => {
    modalOcr.classList.add('open');
    ocrProgressContainer.style.display = 'none';
    ocrResultsContainer.style.display = 'none';
    ocrFileInput.value = '';
  });

  btnOpenPasteModal.addEventListener('click', () => {
    modalPaste.classList.add('open');
    rawReceiptTextarea.value = '';
  });

  // Handle OCR file input (Camera / File)
  ocrFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    ocrProgressContainer.style.display = 'block';
    ocrResultsContainer.style.display = 'none';
    ocrProgressLabel.textContent = 'Initializing optical engine...';
    ocrProgressBar.style.width = '10%';

    try {
      const rawText = await processReceiptImage(file, ({ status, progress }) => {
        ocrProgressLabel.textContent = `${status} (${progress}%)`;
        ocrProgressBar.style.width = `${progress}%`;
      });

      ocrProgressContainer.style.display = 'none';
      ocrDetectedItems = parseReceiptText(rawText);

      if (ocrDetectedItems.length === 0) {
        showToast('No clear line items detected. Try pasting raw text instead.');
      } else {
        renderOcrResults();
      }
    } catch (err) {
      ocrProgressContainer.style.display = 'none';
      console.error(err);
      showToast('OCR Error: ' + err.message);
    }
  });

  // Import detected OCR items into bill
  btnImportOcrItems.addEventListener('click', () => {
    if (ocrDetectedItems.length === 0) return;

    // Append to current dishes
    ocrDetectedItems.forEach(item => {
      quickState.items.push({
        id: 'ocr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3),
        name: item.name,
        price: item.price,
        sharedBy: [...quickState.people]
      });
    });

    modalOcr.classList.remove('open');
    renderQuickSplit();
    showToast(`Imported ${ocrDetectedItems.length} items from receipt!`);
  });

  // Parse raw pasted text
  btnParsePastedText.addEventListener('click', () => {
    const text = rawReceiptTextarea.value;
    const parsed = parseReceiptText(text);

    if (parsed.length === 0) {
      showToast('Could not extract any items. Check format: e.g. "Pizza 14.50"');
      return;
    }

    parsed.forEach(item => {
      quickState.items.push({
        id: 'paste_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3),
        name: item.name,
        price: item.price,
        sharedBy: [...quickState.people]
      });
    });

    modalPaste.classList.remove('open');
    renderQuickSplit();
    showToast(`Added ${parsed.length} items from text!`);
  });
}

function renderOcrResults() {
  ocrResultsContainer.style.display = 'block';
  ocrTbody.innerHTML = '';

  ocrDetectedItems.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="input" type="text" value="${item.name}" style="padding: 4px 6px;"></td>
      <td><input class="input mono" type="number" step="0.01" value="${item.price.toFixed(2)}" style="padding: 4px 6px; width: 80px;"></td>
      <td style="text-align: right;"><button class="key key--sm key--danger" type="button" style="padding: 2px 6px;">✕</button></td>
    `;

    // Keep state in sync with inline edits
    const nameInput = tr.querySelector('input[type="text"]');
    const priceInput = tr.querySelector('input[type="number"]');

    nameInput.addEventListener('input', (e) => { item.name = e.target.value; });
    priceInput.addEventListener('input', (e) => { item.price = parseFloat(e.target.value) || 0; });

    tr.querySelector('.key--danger').addEventListener('click', () => {
      ocrDetectedItems.splice(idx, 1);
      renderOcrResults();
    });

    ocrTbody.appendChild(tr);
  });
}

/* ==========================================================================
   Group Ledger Controller & View
   ========================================================================== */

function initGroupLedger() {
  tripSelector.addEventListener('change', (e) => {
    setActiveTripId(e.target.value);
    renderGroupLedger();
  });

  btnNewTrip.addEventListener('click', () => {
    modalNewTrip.classList.add('open');
    newTripNameInput.value = '';
  });

  formNewTrip.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = newTripNameInput.value.trim();
    const cur = newTripCurrencySelect.value;
    if (!name) return;

    createTrip({ name, currency: cur });
    modalNewTrip.classList.remove('open');
    renderGroupLedger();
    showToast(`Created trip "${name}"!`);
  });

  btnAddTripMember.addEventListener('click', addMemberToActiveTrip);
  newTripMemberName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMemberToActiveTrip();
    }
  });

  btnOpenAddExpense.addEventListener('click', () => {
    const trip = getActiveTrip();
    if (!trip || trip.members.length === 0) {
      showToast('Add members first before logging an expense.');
      return;
    }
    openAddExpenseModal(trip);
  });

  formAddExpense.addEventListener('submit', handleAddExpenseSubmit);

  btnResetTrip.addEventListener('click', () => {
    const trip = getActiveTrip();
    if (!trip) return;
    if (confirm(`Reset all expenses for "${trip.name}"?`)) {
      resetTripExpenses(trip.id);
      renderGroupLedger();
      showToast('Trip expenses reset.');
    }
  });

  btnLoadSampleTrip.addEventListener('click', loadSampleTrip);

  btnCopyTripSummary.addEventListener('click', () => {
    const trip = getActiveTrip();
    if (!trip) return;
    const summary = formatTripSummary(trip);
    navigator.clipboard.writeText(summary).then(() => {
      showToast('Trip settlement copied to clipboard!');
    }).catch(() => {
      showToast('Failed to copy');
    });
  });

  btnCopyPaymentLink.addEventListener('click', () => {
    if (currentPaymentURI) {
      navigator.clipboard.writeText(currentPaymentURI).then(() => {
        showToast('Payment link copied!');
      });
    }
  });
}

function addMemberToActiveTrip() {
  const trip = getActiveTrip();
  if (!trip) return;

  const name = newTripMemberName.value.trim();
  const handle = newTripMemberHandle.value.trim();
  if (!name) return;

  addMemberToTrip(trip.id, { name, handle });
  newTripMemberName.value = '';
  newTripMemberHandle.value = '';
  renderGroupLedger();
}

function openAddExpenseModal(trip) {
  modalAddExpense.classList.add('open');
  expenseTitleInput.value = '';
  expenseAmountInput.value = '';

  // Populate payers
  expensePayerSelect.innerHTML = '';
  trip.members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.name;
    opt.textContent = m.name;
    expensePayerSelect.appendChild(opt);
  });

  // Populate split chips
  expenseSplitMembers.innerHTML = '';
  trip.members.forEach(m => {
    const chip = document.createElement('label');
    chip.className = 'chip-btn active';
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '6px';
    chip.style.cursor = 'pointer';
    chip.innerHTML = `
      <input type="checkbox" value="${m.name}" checked style="accent-color: var(--color-accent);">
      <span>${m.name}</span>
    `;
    expenseSplitMembers.appendChild(chip);
  });
}

function handleAddExpenseSubmit(e) {
  e.preventDefault();
  const trip = getActiveTrip();
  if (!trip) return;

  const title = expenseTitleInput.value.trim() || 'Expense';
  const amount = parseFloat(expenseAmountInput.value) || 0;
  const paidBy = expensePayerSelect.value;

  const checkboxes = expenseSplitMembers.querySelectorAll('input[type="checkbox"]:checked');
  const splitBetween = Array.from(checkboxes).map(cb => cb.value);

  if (amount <= 0) {
    showToast('Please enter an amount.');
    return;
  }
  if (splitBetween.length === 0) {
    showToast('Select at least one person to split with.');
    return;
  }

  addExpenseToTrip(trip.id, {
    title,
    amount,
    paidBy,
    splitBetween
  });

  modalAddExpense.classList.remove('open');
  renderGroupLedger();
  showToast(`Logged expense "${title}" (${trip.currency}${amount.toFixed(2)})`);
}

function renderGroupLedger() {
  const trips = getAllTrips();
  const activeTrip = getActiveTrip();
  if (!activeTrip) return;

  const cur = activeTrip.currency || '$';

  // 1. Populate Trip Switcher
  tripSelector.innerHTML = '';
  trips.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} (${t.currency})`;
    if (t.id === activeTrip.id) opt.selected = true;
    tripSelector.appendChild(opt);
  });

  // 2. Render Participants List
  tripMembersList.innerHTML = '';
  activeTrip.members.forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'chip-btn active';
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '6px';
    chip.innerHTML = `
      <span>${m.name}</span>
      ${m.handle ? `<span class="mono" style="font-size: 10px; opacity: 0.7;">(${m.handle})</span>` : ''}
    `;
    tripMembersList.appendChild(chip);
  });

  // 3. Render Expenses Log
  const expenses = activeTrip.expenses || [];
  tripExpensesTbody.innerHTML = '';

  if (expenses.length === 0) {
    tripExpensesEmpty.style.display = 'block';
    tripExpensesTable.style.display = 'none';
  } else {
    tripExpensesEmpty.style.display = 'none';
    tripExpensesTable.style.display = 'table';

    expenses.forEach(exp => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight: 500;">${exp.title}</div>
          <div style="font-size: 11px; color: var(--color-muted);">${exp.date || ''}</div>
        </td>
        <td class="mono" style="font-weight: 600;">${cur}${parseFloat(exp.amount).toFixed(2)}</td>
        <td>${exp.paidBy}</td>
        <td style="font-size: 12px; color: var(--color-ink-2);">${(exp.splitBetween || []).join(', ')}</td>
        <td style="text-align: right;">
          <button class="key key--sm key--danger" type="button" style="padding: 2px 6px; min-height: 24px;" title="Delete expense">✕</button>
        </td>
      `;

      tr.querySelector('.key--danger').addEventListener('click', () => {
        deleteExpenseFromTrip(activeTrip.id, exp.id);
        renderGroupLedger();
      });

      tripExpensesTbody.appendChild(tr);
    });
  }

  // 4. Compute Totals & Balances
  const totalSpend = expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
  tripTotalSpend.textContent = `${cur}${totalSpend.toFixed(2)}`;
  tripExpenseCount.textContent = expenses.length.toString();

  const balances = calculateNetBalances(activeTrip);
  tripBalancesList.innerHTML = '';

  Object.entries(balances).forEach(([name, bal]) => {
    const isCreditor = bal > 0.005;
    const isDebtor = bal < -0.005;
    const color = isCreditor ? 'var(--color-success)' : isDebtor ? 'var(--color-danger)' : 'var(--color-muted)';
    const sign = bal > 0 ? '+' : '';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.padding = '6px 0';
    row.style.borderBottom = 'var(--rule-hair) solid var(--color-rule)';
    row.style.fontSize = 'var(--text-sm)';
    row.innerHTML = `
      <span>${name}</span>
      <span class="mono" style="color: ${color}; font-weight: 600;">${sign}${cur}${bal.toFixed(2)}</span>
    `;
    tripBalancesList.appendChild(row);
  });

  // 5. Render Minimized Settlements
  const settlements = calculateSettlements(activeTrip);
  tripSettlementList.innerHTML = '';

  if (settlements.length === 0) {
    tripSettlementList.innerHTML = `
      <div style="padding: var(--space-md); text-align: center; color: var(--color-muted); font-size: var(--text-sm);">
        🎉 All settled up! No outstanding payments required.
      </div>
    `;
  } else {
    settlements.forEach(s => {
      const card = document.createElement('div');
      card.className = 'person-share-card';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      card.style.gap = 'var(--space-sm)';
      card.innerHTML = `
        <div>
          <div style="font-weight: 600; font-size: var(--text-sm);">
            ${s.from} ➔ ${s.to}
          </div>
          <div style="font-size: 11px; color: var(--color-muted);">
            Owes ${cur}${s.amount.toFixed(2)} ${s.handle ? `• ${s.handle}` : ''}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: var(--space-xs);">
          <span class="mono" style="font-weight: 700; font-size: var(--text-base); color: var(--color-accent);">${cur}${s.amount.toFixed(2)}</span>
          <button class="key key--sm btn-pay-qr" type="button" title="Show payment QR">📲 Pay QR</button>
        </div>
      `;

      card.querySelector('.btn-pay-qr').addEventListener('click', () => {
        openPaymentQRModal({
          name: s.to,
          handle: s.handle || `${s.to.toLowerCase()}@upi`,
          amount: s.amount,
          currency: cur,
          note: `Pay ${s.to} for ${activeTrip.name}`
        });
      });

      tripSettlementList.appendChild(card);
    });
  }
}

function loadSampleTrip() {
  const trip = createTrip({
    name: 'Goa Weekend 2026',
    currency: '₹',
    members: [
      { name: 'Alice', handle: 'alice@oksbi' },
      { name: 'Bob', handle: 'bob@okhdfc' },
      { name: 'Charlie', handle: 'charlie@upi' },
      { name: 'David', handle: '' }
    ]
  });

  addExpenseToTrip(trip.id, {
    title: 'Beachside Villa Airbnb',
    amount: 14000,
    paidBy: 'Alice',
    splitBetween: ['Alice', 'Bob', 'Charlie', 'David']
  });

  addExpenseToTrip(trip.id, {
    title: 'Seafood Shack Dinner',
    amount: 4200,
    paidBy: 'Bob',
    splitBetween: ['Alice', 'Bob', 'Charlie', 'David']
  });

  addExpenseToTrip(trip.id, {
    title: 'Scooter Rentals (2 Days)',
    amount: 2400,
    paidBy: 'Charlie',
    splitBetween: ['Charlie', 'David']
  });

  addExpenseToTrip(trip.id, {
    title: 'Supermarket Snacks & Drinks',
    amount: 3200,
    paidBy: 'David',
    splitBetween: ['Alice', 'Bob', 'Charlie', 'David']
  });

  renderGroupLedger();
  showToast('Loaded sample Goa Trip with 4 members and expenses!');
}

/* ==========================================================================
   Payment QR Modal Controller
   ========================================================================== */

function openPaymentQRModal({ name, handle, amount, currency, note }) {
  modalQr.classList.add('open');
  qrAmountDisplay.textContent = `${currency}${amount.toFixed(2)}`;
  qrHandleDisplay.textContent = handle ? `To: ${name} (${handle})` : `To: ${name}`;

  const payment = renderPaymentQRCode(qrCodeDisplay, {
    handle,
    amount,
    currency,
    name,
    note
  });

  currentPaymentURI = payment?.uri || '';
}

/* ==========================================================================
   Initialization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupModalClosers();
  initTabs();
  initQuickSplit();
  initOcrAndPaste();
  initGroupLedger();
});
