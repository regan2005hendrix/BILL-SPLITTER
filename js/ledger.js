/**
 * Group Trip & Roommate Expense Ledger Module
 * Provides multi-trip LocalStorage persistence and greedy debt minimization.
 */

const STORAGE_KEY = 'tabby_ledger_trips_v1';
const ACTIVE_TRIP_KEY = 'tabby_active_trip_id_v1';

/**
 * Helper to round cents accurately
 */
function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Loads all trips from localStorage
 * @returns {Array<Object>}
 */
export function getAllTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Saves all trips to localStorage
 */
export function saveAllTrips(trips) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch (e) {
    console.error('Failed to save trips to localStorage:', e);
  }
}

/**
 * Gets the current active trip ID or initializes a default trip if empty
 */
export function getActiveTripId() {
  let activeId = localStorage.getItem(ACTIVE_TRIP_KEY);
  const trips = getAllTrips();

  if (!activeId && trips.length > 0) {
    activeId = trips[0].id;
    setActiveTripId(activeId);
  }
  return activeId;
}

export function setActiveTripId(id) {
  localStorage.setItem(ACTIVE_TRIP_KEY, id);
}

/**
 * Gets the active trip object
 */
export function getActiveTrip(tripId = null) {
  const targetId = tripId || getActiveTripId();
  const trips = getAllTrips();
  let trip = trips.find(t => t.id === targetId);

  // If no trip exists, initialize a default trip
  if (!trip) {
    trip = createTrip({
      name: 'Weekend Getaway',
      currency: '$',
      members: [
        { name: 'Alice', handle: 'alice@upi' },
        { name: 'Bob', handle: 'bob@upi' },
        { name: 'Charlie', handle: '' }
      ]
    });
  }
  return trip;
}

/**
 * Creates a new trip and saves it
 */
export function createTrip({ name = 'New Trip', currency = '$', members = [] }) {
  const trips = getAllTrips();
  const newTrip = {
    id: 'trip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name: name.trim() || 'Untitled Trip',
    currency: currency || '$',
    createdAt: new Date().toISOString(),
    members: members.length > 0 ? members : [{ name: 'Me', handle: '' }],
    expenses: []
  };

  trips.push(newTrip);
  saveAllTrips(trips);
  setActiveTripId(newTrip.id);
  return newTrip;
}

/**
 * Adds a participant to a trip
 */
export function addMemberToTrip(tripId, { name, handle = '' }) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;

  const trips = getAllTrips();
  const trip = trips.find(t => t.id === tripId);
  if (!trip) return null;

  if (!trip.members.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
    trip.members.push({
      name: trimmed,
      handle: (handle || '').trim()
    });
    saveAllTrips(trips);
  }
  return trip;
}

/**
 * Adds an expense to the trip
 */
export function addExpenseToTrip(tripId, {
  title = 'Expense',
  amount = 0,
  paidBy,
  splitBetween = []
}) {
  const trips = getAllTrips();
  const trip = trips.find(t => t.id === tripId);
  if (!trip) return null;

  const validAmount = Math.max(0.01, round2(parseFloat(amount) || 0));
  const validPayer = paidBy || trip.members[0]?.name || 'Unknown';
  const validSplit = splitBetween && splitBetween.length > 0
    ? splitBetween
    : trip.members.map(m => m.name);

  const newExpense = {
    id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    title: title.trim() || 'Expense',
    amount: validAmount,
    paidBy: validPayer,
    splitBetween: validSplit,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  };

  trip.expenses.unshift(newExpense);
  saveAllTrips(trips);
  return trip;
}

/**
 * Deletes an expense from the trip
 */
export function deleteExpenseFromTrip(tripId, expenseId) {
  const trips = getAllTrips();
  const trip = trips.find(t => t.id === tripId);
  if (!trip) return null;

  trip.expenses = trip.expenses.filter(e => e.id !== expenseId);
  saveAllTrips(trips);
  return trip;
}

/**
 * Resets expenses for a trip
 */
export function resetTripExpenses(tripId) {
  const trips = getAllTrips();
  const trip = trips.find(t => t.id === tripId);
  if (!trip) return null;

  trip.expenses = [];
  saveAllTrips(trips);
  return trip;
}

/**
 * Bridge: Exports a meal calculation from Quick Split directly into Group Ledger
 */
export function exportQuickSplitToTrip(tripId, quickSplitResult, mealTitle = 'Group Dinner') {
  if (!quickSplitResult || !quickSplitResult.total) return null;

  const trips = getAllTrips();
  const trip = trips.find(t => t.id === tripId);
  if (!trip) return null;

  // Add any new names from quick split into trip members
  if (quickSplitResult.breakdown) {
    quickSplitResult.breakdown.forEach(b => {
      if (!trip.members.some(m => m.name.toLowerCase() === b.person.toLowerCase())) {
        trip.members.push({ name: b.person, handle: '' });
      }
    });
  }

  // Record meal as an expense
  const payer = trip.members[0]?.name || 'Me';
  const participants = quickSplitResult.breakdown
    ? quickSplitResult.breakdown.map(b => b.person)
    : trip.members.map(m => m.name);

  return addExpenseToTrip(tripId, {
    title: mealTitle,
    amount: quickSplitResult.total,
    paidBy: payer,
    splitBetween: participants
  });
}

/**
 * Computes net balances for each group member: Sum(Paid) - Sum(Owed)
 * Positive balance = Creditor (is owed money)
 * Negative balance = Debtor (owes money to the group)
 * 
 * @param {Object} trip
 * @returns {Record<string, number>}
 */
export function calculateNetBalances(trip) {
  if (!trip || !trip.members) return {};

  const balances = {};
  trip.members.forEach(m => {
    balances[m.name] = 0;
  });

  if (!trip.expenses || trip.expenses.length === 0) {
    return balances;
  }

  trip.expenses.forEach(exp => {
    const amount = parseFloat(exp.amount) || 0;
    const payer = exp.paidBy;
    const splitWith = (exp.splitBetween && exp.splitBetween.length > 0)
      ? exp.splitBetween
      : trip.members.map(m => m.name);

    // Payer paid the total
    if (balances[payer] === undefined) {
      balances[payer] = 0;
    }
    balances[payer] += amount;

    // Beneficiaries each owe their fraction
    const perPersonShare = amount / splitWith.length;
    splitWith.forEach(person => {
      if (balances[person] === undefined) {
        balances[person] = 0;
      }
      balances[person] -= perPersonShare;
    });
  });

  // Round balances to 2 decimals
  Object.keys(balances).forEach(person => {
    balances[person] = round2(balances[person]);
  });

  return balances;
}

/**
 * Greedy Debt Minimization Algorithm
 * Resolves all debts in the minimal number of payment transactions (<= N - 1).
 * 
 * @param {Object} trip
 * @returns {Array<{ from: string, to: string, amount: number, handle: string }>}
 */
export function calculateSettlements(trip) {
  const balances = calculateNetBalances(trip);
  const settlements = [];

  // Partition into Creditors (balance > 0.005) and Debtors (balance < -0.005)
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([name, balance]) => {
    if (balance > 0.005) {
      const member = trip.members?.find(m => m.name === name);
      creditors.push({ name, amount: balance, handle: member?.handle || '' });
    } else if (balance < -0.005) {
      debtors.push({ name, amount: Math.abs(balance) });
    }
  });

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx];
    const debtor = debtors[dIdx];

    const transferAmount = round2(Math.min(creditor.amount, debtor.amount));

    if (transferAmount > 0.005) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: transferAmount,
        handle: creditor.handle
      });
    }

    creditor.amount = round2(creditor.amount - transferAmount);
    debtor.amount = round2(debtor.amount - transferAmount);

    if (creditor.amount <= 0.005) cIdx++;
    if (debtor.amount <= 0.005) dIdx++;
  }

  return settlements;
}

/**
 * Formats full trip settlement plan for group messaging
 */
export function formatTripSummary(trip) {
  if (!trip) return '';
  const balances = calculateNetBalances(trip);
  const settlements = calculateSettlements(trip);

  const totalSpend = (trip.expenses || []).reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
  const cur = trip.currency || '$';

  const lines = [
    `✈️ *Trip Settlement: ${trip.name}*`,
    `Total Group Spend: ${cur}${totalSpend.toFixed(2)} across ${(trip.expenses || []).length} expenses`,
    '-------------------------',
    '*Net Balances:*'
  ];

  Object.entries(balances).forEach(([name, bal]) => {
    const sign = bal >= 0 ? '+' : '-';
    lines.push(`• ${name}: ${sign}${cur}${Math.abs(bal).toFixed(2)}`);
  });

  lines.push('-------------------------');
  lines.push('*Recommended Repayments (Fewest Payments):*');

  if (settlements.length === 0) {
    lines.push('🎉 All balances are settled up! Nobody owes anything.');
  } else {
    settlements.forEach(s => {
      const handleInfo = s.handle ? ` (UPI/Pay: ${s.handle})` : '';
      lines.push(`• *${s.from}* pays *${s.to}*: ${cur}${s.amount.toFixed(2)}${handleInfo}`);
    });
  }

  lines.push('-------------------------');
  lines.push('Calculated cleanly via Tabby // Split');

  return lines.join('\n');
}
