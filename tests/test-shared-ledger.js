import { calculateSharedBalances } from '../js/shared-ledger.js';

export function runSharedLedgerTests() {
  let passed = 0;
  let failed = 0;
  const check = (name, condition) => {
    if (condition) { console.log(`  PASS: ${name}`); passed++; }
    else { console.error(`  FAIL: ${name}`); failed++; }
  };

  const group = {
    members: [{ id: 'alice' }, { id: 'bob' }],
    expenses: [{ amount: 100, paidBy: 'alice', splitBetween: ['alice', 'bob'] }],
    payments: [
      { amount: 50, from: 'bob', to: 'alice', status: 'submitted' },
      { amount: 25, from: 'bob', to: 'alice', status: 'confirmed' }
    ]
  };
  const balances = calculateSharedBalances(group);
  check('confirmed payments reduce the payer debt', balances.bob === -25);
  check('confirmed payments reduce the receiver credit', balances.alice === 25);
  check('submitted payments do not affect official balances', balances.alice !== -25 && balances.bob !== 25);
  return { passed, failed };
}
