/**
 * Unit Test Suite for Receipt OCR & Text Parser
 */
import { parseReceiptText } from '../js/ocr.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passed++;
    console.log(`✔ PASS: ${message}`);
  }
}

export function runOcrParserTests() {
  console.log('--- Running OCR Parser Tests ---');

  // Test 1: Standard restaurant receipt
  {
    const receipt = `
      RISTORANTE BELLA VISTA
      Table 4 - Server: Marco
      Date: 10/29/2026 20:15
      ------------------------------
      Margherita Pizza       14.50
      Linguine Vongole       18.00
      Tiramisu               7.50
      2x Peroni Draft        12.00
      Sparkling Water        4.00
      ------------------------------
      SUBTOTAL               56.00
      TAX (8.5%)             4.76
      TOTAL                  60.76
      Thank you for visiting!
    `;

    const items = parseReceiptText(receipt);
    assert(items.length === 5, `Extracted 5 line items (got ${items.length})`);
    assert(items[0].name.includes('Margherita Pizza') && items[0].price === 14.50, 'Parsed Pizza 14.50');
    assert(items[1].name.includes('Linguine Vongole') && items[1].price === 18.00, 'Parsed Linguine 18.00');
    assert(items[2].name.includes('Tiramisu') && items[2].price === 7.50, 'Parsed Tiramisu 7.50');
    assert(items[3].name.includes('Peroni') && items[3].price === 12.00, 'Parsed Beer 12.00');
    assert(items[4].name.includes('Sparkling Water') && items[4].price === 4.00, 'Parsed Water 4.00');
  }

  // Test 2: Currency symbols and noise filtering
  {
    const receiptWithSymbols = `
      Cafe Central
      1x Avocado Toast $12.50
      1x Flat White $4.25
      TAX $1.34
      TIP $3.00
      TOTAL $21.09
      VISA **** 9821
    `;
    const items = parseReceiptText(receiptWithSymbols);
    assert(items.length === 2, `Filtered noise lines, extracted 2 items (got ${items.length})`);
    assert(items[0].price === 12.50, 'Avocado Toast price 12.50');
    assert(items[1].price === 4.25, 'Flat White price 4.25');
  }

  // Test 3: Raw quick-paste formats (e.g. copied from food delivery or SMS)
  {
    const rawList = `
      Burgers x2 - 24.00
      Loaded Fries : 8.50
      Milkshake 6.00
    `;
    const items = parseReceiptText(rawList);
    assert(items.length === 3, `Parsed 3 items from quick list (got ${items.length})`);
    assert(items[0].price === 24.00, 'Burgers 24.00');
    assert(items[1].price === 8.50, 'Fries 8.50');
    assert(items[2].price === 6.00, 'Milkshake 6.00');
  }

  return { passed, failed };
}

