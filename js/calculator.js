/**
 * Quick Split Calculator Engine
 * Handles proportional tax, tip, discounts, and itemized dish distribution.
 */

/**
 * Rounds an amount based on chosen strategy
 * @param {number} amount
 * @param {'exact'|'up-whole'|'up-half'} mode
 * @returns {number}
 */
export function roundAmount(amount, mode = 'exact') {
  if (isNaN(amount) || amount <= 0) return 0;
  if (mode === 'up-whole') {
    return Math.ceil(amount);
  } else if (mode === 'up-half') {
    return Math.ceil(amount * 2) / 2;
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates equal split across N people
 */
export function calculateEqualSplit({
  subtotal = 0,
  tipPercent = 0,
  taxPercent = 0,
  discountValue = 0,
  peopleCount = 1,
  rounding = 'exact'
}) {
  const safePeople = Math.max(1, parseInt(peopleCount, 10) || 1);
  const rawSubtotal = Math.max(0, parseFloat(subtotal) || 0);
  const discount = Math.max(0, parseFloat(discountValue) || 0);
  
  // Apply discount pre-tax/tip; clamp to zero if discount >= subtotal
  const discountedSubtotal = Math.max(0, rawSubtotal - discount);
  
  const tax = discountedSubtotal * ((parseFloat(taxPercent) || 0) / 100);
  const tip = discountedSubtotal * ((parseFloat(tipPercent) || 0) / 100);
  const grandTotal = discountedSubtotal + tax + tip;
  
  const rawPerPerson = safePeople > 0 ? grandTotal / safePeople : 0;
  const perPerson = roundAmount(rawPerPerson, rounding);

  return {
    subtotal: roundAmount(discountedSubtotal, 'exact'),
    rawSubtotal: roundAmount(rawSubtotal, 'exact'),
    discount: roundAmount(discount, 'exact'),
    tax: roundAmount(tax, 'exact'),
    tip: roundAmount(tip, 'exact'),
    total: roundAmount(grandTotal, 'exact'),
    peopleCount: safePeople,
    perPerson
  };
}

/**
 * Calculates itemized split with proportional tax, tip, and discount
 */
export function calculateItemizedSplit({
  items = [],
  people = [],
  tipPercent = 0,
  taxPercent = 0,
  discountValue = 0,
  rounding = 'exact'
}) {
  const safePeople = people && people.length > 0 ? people : ['Guest 1'];
  const discount = Math.max(0, parseFloat(discountValue) || 0);

  // 1. Compute total subtotal of all items
  let rawSubtotal = 0;
  // Initialize per-person item accumulator and item names tracker
  const personItemsMap = {};
  const personItemNamesMap = {};
  safePeople.forEach(name => {
    personItemsMap[name] = 0;
    personItemNamesMap[name] = [];
  });

  items.forEach(item => {
    const itemPrice = Math.max(0, parseFloat(item.price) || 0);
    rawSubtotal += itemPrice;

    // Parse sharedBy which can contain string names or objects { person, weight }
    let beneficiaries = [];
    if (item.sharedBy && item.sharedBy.length > 0) {
      item.sharedBy.forEach(entry => {
        if (typeof entry === 'string') {
          if (safePeople.includes(entry)) {
            beneficiaries.push({ person: entry, weight: 1 });
          }
        } else if (entry && entry.person && safePeople.includes(entry.person)) {
          beneficiaries.push({
            person: entry.person,
            weight: Math.max(0.01, parseFloat(entry.weight) || 1)
          });
        }
      });
    }

    if (beneficiaries.length === 0) {
      beneficiaries = safePeople.map(p => ({ person: p, weight: 1 }));
    }

    const totalItemWeight = beneficiaries.reduce((sum, b) => sum + b.weight, 0);

    beneficiaries.forEach(b => {
      const shareFraction = totalItemWeight > 0 ? (b.weight / totalItemWeight) : (1 / beneficiaries.length);
      const sharePrice = itemPrice * shareFraction;

      personItemsMap[b.person] = (personItemsMap[b.person] || 0) + sharePrice;
      const weightLabel = b.weight !== 1
        ? ` (${b.weight} shares)`
        : (beneficiaries.length > 1 ? ` (1/${beneficiaries.length})` : '');
      const desc = `${item.name || 'Item'}${weightLabel}`;
      personItemNamesMap[b.person].push(desc);
    });
  });

  // Clamp discount to subtotal
  const actualDiscount = Math.min(discount, rawSubtotal);
  const discountedSubtotal = Math.max(0, rawSubtotal - actualDiscount);
  const discountRatio = rawSubtotal > 0 ? discountedSubtotal / rawSubtotal : 0;

  const tax = discountedSubtotal * ((parseFloat(taxPercent) || 0) / 100);
  const tip = discountedSubtotal * ((parseFloat(tipPercent) || 0) / 100);
  const grandTotal = discountedSubtotal + tax + tip;

  // 2. Proportional allocation for each person
  const breakdown = safePeople.map(person => {
    const personRawItemsTotal = personItemsMap[person] || 0;
    const personFraction = rawSubtotal > 0 ? (personRawItemsTotal / rawSubtotal) : (1 / safePeople.length);

    const personDiscountedItems = personRawItemsTotal * discountRatio;
    const personTax = tax * personFraction;
    const personTip = tip * personFraction;
    const rawPersonTotal = personDiscountedItems + personTax + personTip;

    return {
      person,
      itemsTotal: roundAmount(personRawItemsTotal, 'exact'),
      discountedItems: roundAmount(personDiscountedItems, 'exact'),
      tax: roundAmount(personTax, 'exact'),
      tip: roundAmount(personTip, 'exact'),
      rawTotal: rawPersonTotal,
      total: roundAmount(rawPersonTotal, rounding),
      itemsSummary: personItemNamesMap[person].join(', ') || 'No assigned items'
    };
  });

  return {
    rawSubtotal: roundAmount(rawSubtotal, 'exact'),
    subtotal: roundAmount(discountedSubtotal, 'exact'),
    discount: roundAmount(actualDiscount, 'exact'),
    tax: roundAmount(tax, 'exact'),
    tip: roundAmount(tip, 'exact'),
    total: roundAmount(grandTotal, 'exact'),
    breakdown
  };
}

/**
 * Generates formatted summary for messaging apps (WhatsApp, Telegram, SMS)
 */
export function formatWhatsAppSummary({
  title = 'Dinner Bill',
  currency = '$',
  results
}) {
  if (!results) return '';

  const lines = [
    `🧾 *${title}* (${currency}${results.total.toFixed(2)})`,
    `Subtotal: ${currency}${results.subtotal.toFixed(2)}`
  ];

  if (results.discount > 0) {
    lines.push(`Discount: -${currency}${results.discount.toFixed(2)}`);
  }
  if (results.tax > 0) {
    lines.push(`Tax: ${currency}${results.tax.toFixed(2)}`);
  }
  if (results.tip > 0) {
    lines.push(`Tip: ${currency}${results.tip.toFixed(2)}`);
  }

  lines.push('-------------------------');
  lines.push('*Individual Breakdown:*');

  if (results.breakdown && results.breakdown.length > 0) {
    results.breakdown.forEach(p => {
      lines.push(`• *${p.person}*: ${currency}${p.total.toFixed(2)}`);
      if (p.itemsSummary) {
        lines.push(`  _${p.itemsSummary}_`);
      }
    });
  } else if (results.perPerson) {
    lines.push(`• Split across ${results.peopleCount} people: *${currency}${results.perPerson.toFixed(2)}* each`);
  }

  lines.push('-------------------------');
  lines.push(`*Total: ${currency}${results.total.toFixed(2)}*`);
  lines.push('Settled cleanly via Tabby // Split');

  return lines.join('\n');
}

/**
 * Formats a WhatsApp payment proof confirmation message
 */
export function formatPaymentProofMessage({
  debtorName = '',
  collectorName = '',
  collectorHandle = '',
  amount = 0,
  currency = '₹',
  note = ''
}) {
  const payerTitle = collectorName || 'Payer';
  const debtorTitle = debtorName ? ` - ${debtorName}` : '';
  const upiText = collectorHandle ? ` (${collectorHandle})` : '';
  const noteText = note ? ` for "${note}"` : '';

  return `Hi ${payerTitle}! 👋 I just paid ${currency}${parseFloat(amount || 0).toFixed(2)} to your UPI${upiText}${noteText}. Please check your bank account and confirm!${debtorTitle}`;
}

