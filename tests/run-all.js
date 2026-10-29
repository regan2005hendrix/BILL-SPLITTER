import { runCalculatorTests } from './test-calculator.js';
import { runOcrParserTests } from './test-ocr-parser.js';
import { runLedgerTests } from './test-ledger.js';
import { runQrTests } from './test-qr.js';

async function main() {
  console.log('Running All Tabby Test Suites...\n');
  const t1 = runCalculatorTests();
  const t2 = runOcrParserTests();
  const t3 = runLedgerTests();
  const t4 = runQrTests();

  const totalPassed = t1.passed + t2.passed + t3.passed + t4.passed;
  const totalFailed = t1.failed + t2.failed + t3.failed + t4.failed;

  console.log('\n=============================================');
  console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed.`);
  console.log('=============================================');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

