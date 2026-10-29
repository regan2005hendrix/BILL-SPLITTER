/**
 * Unit Test Suite for Payment QR Module
 */
import { generatePaymentURI } from '../js/qr.js';

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

export function runQrTests() {
  console.log('--- Running QR & Payment URI Tests ---');

  // Test 1: UPI URI format
  {
    const res = generatePaymentURI({
      handle: 'alice@oksbi',
      amount: 45.50,
      currency: '₹',
      name: 'Alice',
      note: 'Dinner Share'
    });
    assert(res.type === 'upi', 'Detected UPI handle');
    assert(res.uri.startsWith('upi://pay?pa=alice%40oksbi'), 'UPI URI has encoded VPA');
    assert(res.uri.includes('&am=45.50'), 'UPI URI includes exact amount 45.50');
  }

  // Test 2: Venmo handle format
  {
    const res = generatePaymentURI({
      handle: '@bob_smith',
      amount: 22.00,
      currency: '$',
      name: 'Bob',
      note: 'Pizza'
    });
    assert(res.type === 'venmo', 'Detected Venmo handle');
    assert(res.uri.includes('recipients=bob_smith'), 'Venmo URI has stripped recipient handle');
    assert(res.uri.includes('amount=22.00'), 'Venmo URI includes amount 22.00');
  }

  return { passed, failed };
}

