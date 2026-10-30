/**
 * Unit Test Suite for Quick Split Calculator
 */
import {
  calculateEqualSplit,
  calculateItemizedSplit,
  formatWhatsAppSummary,
  formatPaymentProofMessage,
  roundAmount
} from '../js/calculator.js';

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

function assertClose(actual, expected, message) {
  const diff = Math.abs(actual - expected);
  if (diff > 0.01) {
    failed++;
    console.error(`❌ FAIL: ${message} (expected ${expected}, got ${actual})`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passed++;
    console.log(`✔ PASS: ${message}`);
  }
}

export function runCalculatorTests() {
  console.log('--- Running Calculator Tests ---');

  // Test 1: Equal Split standard math
  {
    const res = calculateEqualSplit({
      subtotal: 100,
      tipPercent: 15,
      taxPercent: 8,
      discountValue: 0,
      peopleCount: 2,
      rounding: 'exact'
    });
    assertClose(res.subtotal, 100, 'Subtotal is 100');
    assertClose(res.tax, 8, 'Tax is 8');
    assertClose(res.tip, 15, 'Tip is 15');
    assertClose(res.total, 123, 'Total is 123');
    assertClose(res.perPerson, 61.50, 'Per person is 61.50');
  }

  // Test 2: Equal Split with discount & round up
  {
    const res = calculateEqualSplit({
      subtotal: 100,
      tipPercent: 15,
      taxPercent: 10,
      discountValue: 20,
      peopleCount: 3,
      rounding: 'up-whole'
    });
    // Subtotal after discount: 80. Tax 10% on 80: 8. Tip 15% on 80: 12. Total = 100.
    // 100 / 3 = 33.33 -> round up whole = 34.00
    assertClose(res.subtotal, 80, 'Subtotal after discount is 80');
    assertClose(res.total, 100, 'Total with discount is 100');
    assert(res.perPerson === 34, `Rounded up per person is 34 (got ${res.perPerson})`);
  }

  // Test 3: Itemized Split with proportional tax and tip
  {
    const people = ['Alice', 'Bob', 'Charlie'];
    const items = [
      { id: '1', name: 'Pizza', price: 20, sharedBy: ['Alice', 'Bob'] },
      { id: '2', name: 'Wine', price: 10, sharedBy: ['Alice'] },
      { id: '3', name: 'Beer', price: 5, sharedBy: ['Bob'] },
      { id: '4', name: 'Dessert', price: 9, sharedBy: ['Alice', 'Bob', 'Charlie'] }
    ];

    const res = calculateItemizedSplit({
      items,
      people,
      tipPercent: 10,
      taxPercent: 10,
      discountValue: 0,
      rounding: 'exact'
    });

    // Subtotal = 20 + 10 + 5 + 9 = 44
    // Tax = 4.40, Tip = 4.40, Total = 52.80
    assertClose(res.subtotal, 44, 'Subtotal is 44');
    assertClose(res.total, 52.80, 'Total is 52.80');

    // Alice: items = 10 + 10 + 3 = 23 (23 / 44 * 52.80 = 27.60)
    // Bob: items = 10 + 5 + 3 = 18 (18 / 44 * 52.80 = 21.60)
    // Charlie: items = 3 (3 / 44 * 52.80 = 3.60)
    const alice = res.breakdown.find(p => p.person === 'Alice');
    const bob = res.breakdown.find(p => p.person === 'Bob');
    const charlie = res.breakdown.find(p => p.person === 'Charlie');

    assertClose(alice.itemsTotal, 23, 'Alice items total 23');
    assertClose(alice.total, 27.60, 'Alice owes 27.60');
    assertClose(bob.itemsTotal, 18, 'Bob items total 18');
    assertClose(bob.total, 21.60, 'Bob owes 21.60');
    assertClose(charlie.itemsTotal, 3, 'Charlie items total 3');
    assertClose(charlie.total, 3.60, 'Charlie owes 3.60');

    // Sum check
    const sumOwed = res.breakdown.reduce((acc, p) => acc + p.total, 0);
    assertClose(sumOwed, res.total, 'Sum of individual shares matches total');
  }

  // Test 4: Discount exceeds subtotal clamp
  {
    const res = calculateEqualSplit({
      subtotal: 50,
      tipPercent: 15,
      taxPercent: 10,
      discountValue: 100, // exceeds subtotal
      peopleCount: 2,
      rounding: 'exact'
    });
    assert(res.subtotal === 0, 'Discount clamps subtotal to 0');
    assert(res.total === 0, 'Total clamps to 0');
    assert(res.perPerson === 0, 'Per person clamps to 0');
  }

  // Test 5: WhatsApp summary format
  {
    const summary = formatWhatsAppSummary({
      title: 'Italian Dinner',
      currency: '$',
      results: {
        subtotal: 44,
        tax: 4.40,
        tip: 4.40,
        discount: 0,
        total: 52.80,
        breakdown: [
          { person: 'Alice', total: 27.60, itemsSummary: 'Pizza (half), Wine, Dessert' },
          { person: 'Bob', total: 21.60, itemsSummary: 'Pizza (half), Beer, Dessert' }
        ]
      }
    });
    assert(summary.includes('Italian Dinner'), 'Summary contains title');
    assert(summary.includes('Alice*: $27.60') || summary.includes('Alice: $27.60'), 'Summary contains Alice amount');
    assert(summary.includes('Bob*: $21.60') || summary.includes('Bob: $21.60'), 'Summary contains Bob amount');
  }

  // Test 6: Unequal dish weights (e.g. 2 shares vs 1 share)
  {
    const itemsWeighted = [
      {
        id: '1',
        name: 'Large Pizza',
        price: 30.00,
        sharedBy: [
          { person: 'Alice', weight: 2 },
          { person: 'Bob', weight: 1 }
        ]
      }
    ];
    const weightedRes = calculateItemizedSplit({
      items: itemsWeighted,
      people: ['Alice', 'Bob'],
      tipPercent: 0,
      taxPercent: 0,
      discountValue: 0,
      rounding: 'exact'
    });
    const aliceW = weightedRes.breakdown.find(p => p.person === 'Alice');
    const bobW = weightedRes.breakdown.find(p => p.person === 'Bob');
    assertClose(aliceW.total, 20.00, 'Alice pays $20 for 2 shares of pizza');
    assertClose(bobW.total, 10.00, 'Bob pays $10 for 1 share of pizza');
  }

  // Test 7: WhatsApp payment proof message format
  {
    const proofMsg = formatPaymentProofMessage({
      debtorName: 'Bob',
      collectorName: 'Alice',
      collectorHandle: 'alice@okhdfcbank',
      amount: 249.00,
      currency: '₹',
      note: 'Masala Dosa & Tea'
    });
    assert(proofMsg.includes('Hi Alice!'), 'Proof contains collector name');
    assert(proofMsg.includes('₹249.00'), 'Proof contains exact amount');
    assert(proofMsg.includes('alice@okhdfcbank'), 'Proof contains collector UPI ID');
    assert(proofMsg.includes('Masala Dosa & Tea'), 'Proof contains bill note');
    assert(proofMsg.includes('- Bob'), 'Proof signed by debtor');
  }

  return { passed, failed };
}
