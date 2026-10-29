/**
 * Unit Test Suite for Group Ledger & Debt Minimization Engine
 */
import {
  calculateNetBalances,
  calculateSettlements,
  createTrip,
  updateTripDetails,
  removeMemberFromTrip,
  getActiveTrip
} from '../js/ledger.js';

// Polyfill localStorage for headless node test runner
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

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

export function runLedgerTests() {
  console.log('--- Running Ledger & Debt Minimization Tests ---');

  // Test 1: Standard 3-person expenses
  {
    const trip = {
      members: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Charlie' }
      ],
      expenses: [
        {
          id: 'exp1',
          title: 'Groceries',
          amount: 60,
          paidBy: 'Alice',
          splitBetween: ['Alice', 'Bob', 'Charlie']
        },
        {
          id: 'exp2',
          title: 'Fuel',
          amount: 30,
          paidBy: 'Bob',
          splitBetween: ['Bob', 'Charlie']
        }
      ]
    };

    const balances = calculateNetBalances(trip);
    assertClose(balances['Alice'], 40.00, 'Alice net balance is +$40.00');
    assertClose(balances['Bob'], -5.00, 'Bob net balance is -$5.00');
    assertClose(balances['Charlie'], -35.00, 'Charlie net balance is -$35.00');

    // Total net balance sum must be zero
    const sumBalances = Object.values(balances).reduce((a, b) => a + b, 0);
    assertClose(sumBalances, 0, 'Sum of all net balances is strictly 0');

    // Settlements
    const settlements = calculateSettlements(trip);
    assert(settlements.length === 2, `Settles in 2 transactions (got ${settlements.length})`);

    const charlieToAlice = settlements.find(s => s.from === 'Charlie' && s.to === 'Alice');
    const bobToAlice = settlements.find(s => s.from === 'Bob' && s.to === 'Alice');

    assert(charlieToAlice && Math.abs(charlieToAlice.amount - 35) < 0.01, 'Charlie pays Alice $35');
    assert(bobToAlice && Math.abs(bobToAlice.amount - 5) < 0.01, 'Bob pays Alice $5');
  }

  // Test 2: Cyclic debts resolution (A -> B -> C -> A)
  {
    const cyclicTrip = {
      members: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      expenses: [
        { id: '1', title: 'Lunch', amount: 30, paidBy: 'A', splitBetween: ['B'] }, // B owes A 30
        { id: '2', title: 'Dinner', amount: 30, paidBy: 'B', splitBetween: ['C'] }, // C owes B 30
        { id: '3', title: 'Drinks', amount: 30, paidBy: 'C', splitBetween: ['A'] }  // A owes C 30
      ]
    };

    const balances = calculateNetBalances(cyclicTrip);
    assertClose(balances['A'], 0, 'A balance is 0');
    assertClose(balances['B'], 0, 'B balance is 0');
    assertClose(balances['C'], 0, 'C balance is 0');

    const settlements = calculateSettlements(cyclicTrip);
    assert(settlements.length === 0, 'Cyclic debts resolve to 0 payments');
  }

  // Test 3: Fractional penny splits (10 divided by 3)
  {
    const tripFraction = {
      members: [{ name: 'X' }, { name: 'Y' }, { name: 'Z' }],
      expenses: [
        { id: '1', title: 'Taxi', amount: 10, paidBy: 'X', splitBetween: ['X', 'Y', 'Z'] }
      ]
    };

    const settlements = calculateSettlements(tripFraction);
    const totalSettled = settlements.reduce((acc, s) => acc + s.amount, 0);
    assertClose(totalSettled, 6.67, 'Total payments settle $6.67 owed to X');
    assert(settlements.length <= 2, 'Settles within N-1 transactions');
  }

  // Test 4: Penny residual re-centering to guarantee exact net zero balance
  {
    const tripOdd = {
      members: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      expenses: [
        { id: '1', title: 'Lunch', amount: 10.00, paidBy: 'A', splitBetween: ['A', 'B', 'C'] }
      ]
    };
    const net = calculateNetBalances(tripOdd);
    const sumNet = Math.round((Object.values(net).reduce((a, b) => a + b, 0)) * 100) / 100;
    assert(sumNet === 0, `Net balances sum is strictly 0.00 (got ${sumNet})`);
  }

  // Test 5: Create trip with location and currency
  {
    const trip = createTrip({
      name: 'Goa Holiday',
      location: 'Goa, India',
      currency: '₹',
      members: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }]
    });
    assert(trip.name === 'Goa Holiday', 'Trip name saved');
    assert(trip.location === 'Goa, India', 'Trip location saved');
    assert(trip.currency === '₹', 'Trip currency saved');
    assert(trip.members.length === 3, 'Trip has 3 members');

    // Test 6: Update trip details
    const updated = updateTripDetails(trip.id, {
      name: 'South Goa Beach Retreat',
      location: 'Palolem, Goa'
    });
    assert(updated.name === 'South Goa Beach Retreat', 'Updated trip name');
    assert(updated.location === 'Palolem, Goa', 'Updated trip location');

    // Test 7: Remove member from trip
    const afterRemoval = removeMemberFromTrip(trip.id, 'Bob');
    assert(afterRemoval.members.length === 2, 'Member removed from trip');
    assert(!afterRemoval.members.some(m => m.name === 'Bob'), 'Bob no longer in trip members');
  }

  return { passed, failed };
}

