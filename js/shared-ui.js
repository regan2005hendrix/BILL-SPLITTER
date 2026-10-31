import {
  initialiseSharedLedger, isSharedLedgerEnabled, observeAuth, signInWithGoogle,
  sendEmailSignInLink, completeEmailSignIn, signOutSharedUser, upsertProfile,
  getProfile,
  createSharedGroup, observeSharedGroups, observeSharedGroup, addSharedExpense,
  createPaymentLink, observePaymentLinks, observePublicPaymentLink, submitPublicPaymentLink,
  confirmPaymentLink, calculateSharedBalances
} from './shared-ledger.js';

let root;
let user = null;
let profile = null;
let groups = [];
let selectedGroupId = '';
let activeGroup = null;
let stopGroups = null;
let stopGroup = null;
let getLocalTrip = null;
let paymentLinks = [];
let stopPaymentLinks = null;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const amount = (currency, value) => `${currency || '₹'}${(Number(value) || 0).toFixed(2)}`;

function memberName(group, id) {
  return group.members.find(member => member.id === id)?.name || 'Unclaimed member';
}

function settlements(group) {
  const balances = calculateSharedBalances(group);
  const debtors = Object.entries(balances).filter(([, value]) => value < -0.005).map(([id, value]) => ({ id, amount: -value }));
  const creditors = Object.entries(balances).filter(([, value]) => value > 0.005).map(([id, value]) => ({ id, amount: value }));
  const result = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtors[debtorIndex] && creditors[creditorIndex]) {
    const owed = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
    result.push({ from: debtors[debtorIndex].id, to: creditors[creditorIndex].id, amount: Math.round(owed * 100) / 100 });
    debtors[debtorIndex].amount -= owed;
    creditors[creditorIndex].amount -= owed;
    if (debtors[debtorIndex].amount < 0.005) debtorIndex++;
    if (creditors[creditorIndex].amount < 0.005) creditorIndex++;
  }
  return result;
}

function renderSetupMessage() {
  root.innerHTML = `
    <section class="panel" style="margin-bottom: var(--space-lg);">
      <h2 class="panel-title">Shared profiles</h2>
      <p class="panel-desc">Firebase is not configured yet. Quick Split and local trips remain available on this device.</p>
      <p style="font-size: var(--text-xs); color: var(--color-muted); margin: 0;">Add your Firebase Web App values to <code>js/firebase-config.js</code>, then deploy.</p>
    </section>`;
}

function renderSignedOut() {
  root.innerHTML = `
    <section class="panel" style="margin-bottom: var(--space-lg);">
      <div class="panel-header"><div><h2 class="panel-title">Shared group ledger</h2><p class="panel-desc">Sign in to join private groups and track verified repayments.</p></div></div>
      <div class="form-row"><button id="shared-google" class="key key--primary" type="button">Continue with Google</button></div>
      <form id="shared-email-form" class="form-row" style="margin-top: var(--space-sm);">
        <input id="shared-email" class="input" type="email" required placeholder="you@example.com" style="flex:1;">
        <button class="key" type="submit">Email me a sign-in link</button>
      </form>
    </section>`;
  root.querySelector('#shared-google').addEventListener('click', async () => run(signInWithGoogle, 'Signed in.'));
  root.querySelector('#shared-email-form').addEventListener('submit', async event => {
    event.preventDefault();
    await run(() => sendEmailSignInLink(root.querySelector('#shared-email').value), 'Check your email for the secure sign-in link.');
  });
}

function renderPublicPaymentLink(link) {
  if (!link) {
    root.innerHTML = '<section class="panel"><h2 class="panel-title">Payment link unavailable</h2><p class="panel-desc">This payment link is invalid or has been removed.</p></section>';
    return;
  }
  const paid = link.status === 'confirmed';
  const submitted = link.status === 'submitted';
  root.innerHTML = `<section class="panel" style="max-width:620px; margin:var(--space-xl) auto;">
    <h2 class="panel-title">Payment request</h2>
    <p class="panel-desc">${esc(link.fromName)} owes ${esc(link.toName)}</p>
    <div class="receipt-card"><div class="summary-row"><span>Amount due</span><strong class="mono amount">${amount(link.currency, link.amount)}</strong></div>${link.upiHandle ? `<div class="summary-row"><span>Pay to UPI</span><span class="mono">${esc(link.upiHandle)}</span></div>` : ''}</div>
    <p class="panel-desc" style="margin-top:var(--space-md)">${paid ? 'Payment confirmed by the collector.' : submitted ? 'Payment submitted — waiting for the collector to confirm it.' : 'After making the transfer, mark it as paid so the collector can verify it.'}</p>
    ${!paid && !submitted ? '<button id="public-paid" class="key key--primary" type="button">I have paid</button>' : ''}
  </section>`;
  root.querySelector('#public-paid')?.addEventListener('click', () => run(() => submitPublicPaymentLink(link.id), 'Payment submitted for verification.'));
}

function renderProfileAndGroups() {
  const groupOptions = groups.map(group => `<option value="${esc(group.id)}" ${group.id === selectedGroupId ? 'selected' : ''}>${esc(group.name)}</option>`).join('');
  root.innerHTML = `
    <section class="panel" style="margin-bottom: var(--space-lg);">
      <div class="panel-header"><div><h2 class="panel-title">Your shared profile</h2><p class="panel-desc">${esc(user.displayName || user.email || 'Signed in')}</p></div><button id="shared-signout" class="key key--sm" type="button">Sign out</button></div>
      <form id="shared-profile-form" class="form-row">
        <input id="shared-profile-name" class="input" required value="${esc(profile?.displayName || user.displayName || '')}" placeholder="Display name" style="flex:1;">
        <input id="shared-profile-upi" class="input mono" value="${esc(profile?.upiHandle || '')}" placeholder="UPI ID (optional)" style="flex:1;">
        <button class="key" type="submit">Save profile</button>
      </form>
    </section>
    <section class="panel" style="margin-bottom: var(--space-lg);">
      <div class="panel-header"><div><h2 class="panel-title">Shared groups</h2><p class="panel-desc">Your live balances and verified payments.</p></div></div>
      <div class="form-row">
        <select id="shared-group-selector" class="input" style="flex:1;"><option value="">Choose a group</option>${groupOptions}</select>
        <button id="shared-new-group" class="key key--primary" type="button">+ New group</button>
        <button id="shared-import-local" class="key key--sm" type="button" ${getLocalTrip ? '' : 'disabled'}>Import local trip</button>
      </div>
      <form id="shared-new-group-form" class="form-row" style="display:none; margin-top: var(--space-sm);">
        <input id="shared-group-name" class="input" required placeholder="Group name (e.g. Goa Weekend)" style="flex:1;">
        <select id="shared-group-currency" class="input" style="width:auto;"><option value="₹">₹ INR</option><option value="$">$ USD</option><option value="€">€ EUR</option><option value="£">£ GBP</option></select>
        <button class="key key--primary" type="submit">Create</button>
      </form>
    </section>
    <div id="shared-group-content"></div>`;

  root.querySelector('#shared-signout').addEventListener('click', () => run(signOutSharedUser));
  root.querySelector('#shared-profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    await run(async () => { profile = await upsertProfile(user, { displayName: root.querySelector('#shared-profile-name').value, upiHandle: root.querySelector('#shared-profile-upi').value }); }, 'Profile saved.');
  });
  root.querySelector('#shared-group-selector').addEventListener('change', event => selectGroup(event.target.value));
  root.querySelector('#shared-new-group').addEventListener('click', () => { root.querySelector('#shared-new-group-form').style.display = 'flex'; });
  root.querySelector('#shared-import-local').addEventListener('click', async () => {
    const localTrip = getLocalTrip?.();
    if (!localTrip || !window.confirm(`Import "${localTrip.name}" into a new shared group? Your local trip will not be changed.`)) return;
    const { importLocalTrip } = await import('./shared-ledger.js');
    await run(async () => {
      const group = await importLocalTrip(localTrip, user);
      selectedGroupId = group.id;
    }, 'Local trip imported as a shared group.');
  });
  root.querySelector('#shared-new-group-form').addEventListener('submit', async event => {
    event.preventDefault();
    const name = root.querySelector('#shared-group-name').value;
    const currency = root.querySelector('#shared-group-currency').value;
    await run(async () => {
      const group = await createSharedGroup({ name, currency, owner: user });
      selectedGroupId = group.id;
    }, 'Shared group created.');
  });
  renderGroupContent();
}

function renderGroupContent() {
  const container = root.querySelector('#shared-group-content');
  if (!container) return;
  if (!activeGroup) {
    container.innerHTML = '<section class="panel"><p class="panel-desc">Create or choose a shared group to see member balances.</p></section>';
    return;
  }
  const balances = calculateSharedBalances(activeGroup);
  const mine = balances[user.uid] || 0;
  const currency = activeGroup.currency;
  const memberRows = activeGroup.members.map(member => {
    const value = balances[member.id] || 0;
    const status = member.uid ? 'Active profile' : 'Invite pending';
    return `<div class="summary-row"><span>${esc(member.name)} <small style="color:var(--color-muted)">${status}</small></span><span class="mono" style="color:${value < -0.005 ? 'var(--color-danger)' : value > 0.005 ? 'var(--color-success)' : 'var(--color-muted)'}">${value > 0 ? '+' : ''}${amount(currency, value)}</span></div>`;
  }).join('');
  const paymentRows = activeGroup.payments.slice().sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)).map(payment => `<div class="summary-row"><span>${esc(memberName(activeGroup, payment.from))} → ${esc(memberName(activeGroup, payment.to))}<br><small style="color:var(--color-muted)">${esc(payment.status)}</small></span><span class="mono">${amount(currency, payment.amount)}</span></div>`).join('') || '<p class="panel-desc">No confirmed payments yet.</p>';
  const canManage = activeGroup.ownerId === user.uid;
  const routeRows = settlements(activeGroup).map(route => {
    const existingLink = paymentLinks.find(link => link.groupId === activeGroup.id && link.from === route.from && link.to === route.to && link.status !== 'confirmed');
    return `<div class="person-share-card" style="margin-bottom:var(--space-xs)"><strong>${esc(memberName(activeGroup, route.from))} → ${esc(memberName(activeGroup, route.to))}</strong><br><span class="mono">${amount(currency, route.amount)}</span>${existingLink ? `<span class="status-badge-paid" style="margin-left:8px">${esc(existingLink.status)}</span>` : ''}${canManage && !existingLink ? `<button class="key key--sm key--primary shared-create-link" data-from="${esc(route.from)}" data-to="${esc(route.to)}" data-amount="${route.amount}" style="margin-left:8px">Create payment link</button>` : ''}</div>`;
  }).join('') || '<p class="panel-desc">Everyone is settled up.</p>';
  const memberOptions = activeGroup.members.map(member => `<option value="${esc(member.id)}">${esc(member.name)}</option>`).join('');
  const groupLinks = paymentLinks.filter(link => link.groupId === activeGroup.id);
  const linkRows = groupLinks.map(link => `<div class="summary-row"><span>${esc(link.fromName)} → ${esc(link.toName)}<br><small style="color:var(--color-muted)">${esc(link.status)}</small></span><span>${link.status === 'submitted' ? `<button class="key key--sm key--primary shared-confirm-link" data-id="${esc(link.id)}">Confirm received</button>` : ''}</span></div>`).join('') || '<p class="panel-desc">Create a payment link for each outstanding repayment.</p>';
  container.innerHTML = `
    <section class="panel" style="margin-bottom:var(--space-lg)">
      <div class="panel-header"><div><h2 class="panel-title">${esc(activeGroup.name)}</h2><p class="panel-desc">Your position: <strong>${mine < -0.005 ? `You owe ${amount(currency, -mine)}` : mine > 0.005 ? `You are owed ${amount(currency, mine)}` : 'Settled up'}</strong></p></div></div>
      <div class="receipt-card">${memberRows}</div>
      ${canManage ? `<div style="margin-top:var(--space-md)"><h3 class="panel-title" style="font-size:var(--text-sm)">Shared payment links</h3>${linkRows}</div>` : ''}
    </section>
    <section class="panel" style="margin-bottom:var(--space-lg)">
      <h3 class="panel-title">Log a shared expense</h3>
      <form id="shared-expense-form">
        <div class="form-row"><input id="shared-expense-title" class="input" required placeholder="Expense description" style="flex:1"><input id="shared-expense-amount" class="input mono" required min="0.01" step="0.01" type="number" placeholder="Amount" style="max-width:150px"></div>
        <label class="label" style="margin-top:var(--space-sm)">Paid by</label><select id="shared-expense-payer" class="input">${memberOptions}</select>
        <label class="label" style="margin-top:var(--space-sm)">Split with</label><div id="shared-expense-split" class="preset-chips">${activeGroup.members.map(member => `<label class="chip active"><input type="checkbox" checked value="${esc(member.id)}"> ${esc(member.name)}</label>`).join('')}</div>
        <button class="key key--primary" style="margin-top:var(--space-sm)" type="submit">Save expense</button>
      </form>
    </section>
    <section class="panel"><h3 class="panel-title">Repayments</h3>${routeRows}<h3 class="panel-title" style="margin-top:var(--space-lg)">Payment history</h3>${paymentRows}</section>`;
  container.querySelector('#shared-expense-form').addEventListener('submit', async event => {
    event.preventDefault();
    const splitBetween = [...container.querySelectorAll('#shared-expense-split input:checked')].map(input => input.value);
    if (!splitBetween.length) return notify('Select at least one member.');
    await run(() => addSharedExpense(activeGroup.id, { title: container.querySelector('#shared-expense-title').value, amount: container.querySelector('#shared-expense-amount').value, paidBy: container.querySelector('#shared-expense-payer').value, splitBetween }), 'Expense saved.');
  });
  container.querySelectorAll('.shared-create-link').forEach(button => button.addEventListener('click', () => run(async () => {
    const link = await createPaymentLink(activeGroup, button.dataset);
    const url = `${window.location.origin}${window.location.pathname}?pay=${encodeURIComponent(link.id)}`;
    await navigator.clipboard?.writeText(url);
  }, 'Payment link copied. Send it by WhatsApp or email.')));
  container.querySelectorAll('.shared-confirm-link').forEach(button => button.addEventListener('click', () => {
    const link = paymentLinks.find(item => item.id === button.dataset.id);
    if (link) run(() => confirmPaymentLink(link), 'Payment confirmed and applied to balances.');
  }));
}

function selectGroup(groupId) {
  selectedGroupId = groupId;
  activeGroup = null;
  if (stopGroup) stopGroup();
  if (groupId) stopGroup = observeSharedGroup(groupId, group => { activeGroup = group; renderGroupContent(); });
  renderProfileAndGroups();
}

function notify(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3200);
}

async function run(action, successMessage = '') {
  try { await action(); if (successMessage) notify(successMessage); }
  catch (error) { console.error(error); notify(describeFirebaseError(error)); }
}

function describeFirebaseError(error) {
  const code = error?.code || '';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is disabled. Enable Google in Firebase Authentication → Sign-in method.';
  if (code === 'auth/unauthorized-domain') return 'This site is not an authorized Firebase domain. Add its domain in Authentication → Settings → Authorized domains.';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the Google pop-up. Allow pop-ups for this site, then try again.';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled before it finished.';
  if (code === 'auth/invalid-api-key') return 'The Firebase API key is invalid. Recheck js/firebase-config.js.';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'Firestore denied this action. Deploy the updated Firestore rules below.';
  return error?.message || 'Something went wrong.';
}

export async function initSharedUI(container, options = {}) {
  root = container;
  getLocalTrip = options.getLocalTrip || null;
  if (!isSharedLedgerEnabled()) return renderSetupMessage();
  await initialiseSharedLedger();
  const paymentLinkId = new URLSearchParams(window.location.search).get('pay');
  if (paymentLinkId) return observePublicPaymentLink(paymentLinkId, renderPublicPaymentLink);
  // Email-link sign-in must finish on the same browser (or ask for the email
  // address once when the user opened the link somewhere else).
  try {
    const emailLinkUser = await completeEmailSignIn();
    if (emailLinkUser) notify('Email sign-in complete.');
  } catch (error) {
    if (window.location.href.includes('oobCode')) {
      const email = window.prompt('Enter the email address that received this sign-in link:');
      if (email) await run(() => completeEmailSignIn(window.location.href, email), 'Email sign-in complete.');
    }
  }
  observeAuth(async currentUser => {
    user = currentUser;
    if (!user) { if (stopGroups) stopGroups(); groups = []; activeGroup = null; profile = null; return renderSignedOut(); }
    try { profile = await getProfile(user.uid); }
    catch (error) { console.error('Profile read failed:', error); profile = null; notify(describeFirebaseError(error)); }
    if (stopPaymentLinks) stopPaymentLinks();
    stopPaymentLinks = observePaymentLinks(user.uid, links => { paymentLinks = links; renderGroupContent(); });
    stopGroups = observeSharedGroups(user.uid, nextGroups => {
      groups = nextGroups;
      if (!selectedGroupId || !groups.some(group => group.id === selectedGroupId)) selectedGroupId = groups[0]?.id || '';
      renderProfileAndGroups();
      if (selectedGroupId && !activeGroup) selectGroup(selectedGroupId);
    });
  });
}
