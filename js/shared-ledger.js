/**
 * Firebase-backed shared ledger.
 *
 * This module is intentionally isolated from the local ledger so Quick Split
 * and existing browser-only trips continue working without a Firebase project.
 */
import { firebaseConfig, firebaseEnabled, firebaseDatabaseId } from './firebase-config.js';

let sdk = null;
let auth = null;
let db = null;

const SDK_VERSION = '10.14.1';

export async function initialiseSharedLedger() {
  if (!firebaseEnabled) return { enabled: false };
  if (sdk) return { enabled: true, auth, db };

  const [appSdk, authSdk, firestoreSdk] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`)
  ]);

  const app = appSdk.initializeApp(firebaseConfig);
  auth = authSdk.getAuth(app);
  db = firestoreSdk.getFirestore(app, firebaseDatabaseId);
  sdk = { ...authSdk, ...firestoreSdk };
  return { enabled: true, auth, db };
}

export function isSharedLedgerEnabled() {
  return firebaseEnabled;
}

export async function observeAuth(callback) {
  const ready = await initialiseSharedLedger();
  if (!ready.enabled) return () => callback(null);
  return sdk.onAuthStateChanged(auth, async user => {
    if (user) {
      try { await upsertProfile(user); }
      catch (error) { console.error('Profile creation failed:', error); }
    }
    callback(user || null);
  });
}

export async function signInWithGoogle() {
  await initialiseSharedLedger();
  const provider = new sdk.GoogleAuthProvider();
  return sdk.signInWithPopup(auth, provider);
}

export async function sendEmailSignInLink(email, continueUrl = window.location.href) {
  await initialiseSharedLedger();
  await sdk.sendSignInLinkToEmail(auth, email, {
    url: continueUrl,
    handleCodeInApp: true
  });
  localStorage.setItem('tabby_email_for_signin', email);
}

export async function completeEmailSignIn(url = window.location.href, email = '') {
  await initialiseSharedLedger();
  if (!sdk.isSignInWithEmailLink(auth, url)) return null;
  const savedEmail = email || localStorage.getItem('tabby_email_for_signin');
  if (!savedEmail) throw new Error('Enter the email address that received the sign-in link.');
  const result = await sdk.signInWithEmailLink(auth, savedEmail, url);
  localStorage.removeItem('tabby_email_for_signin');
  return result.user;
}

export async function signOutSharedUser() {
  await initialiseSharedLedger();
  return sdk.signOut(auth);
}

export async function upsertProfile(user, updates = {}) {
  await initialiseSharedLedger();
  const ref = sdk.doc(db, 'users', user.uid);
  const existing = await sdk.getDoc(ref);
  const profile = {
    displayName: updates.displayName || user.displayName || existing.data()?.displayName || user.email?.split('@')[0] || 'Member',
    email: user.email || existing.data()?.email || '',
    photoURL: user.photoURL || existing.data()?.photoURL || '',
    upiHandle: updates.upiHandle ?? existing.data()?.upiHandle ?? '',
    updatedAt: sdk.serverTimestamp()
  };
  if (!existing.exists()) profile.createdAt = sdk.serverTimestamp();
  await sdk.setDoc(ref, profile, { merge: true });
  return { id: user.uid, ...profile };
}

export async function getProfile(uid) {
  await initialiseSharedLedger();
  const profile = await sdk.getDoc(sdk.doc(db, 'users', uid));
  return profile.exists() ? { id: profile.id, ...profile.data() } : null;
}

export async function createSharedGroup({ name, currency, owner, members = [] }) {
  await initialiseSharedLedger();
  const groupRef = sdk.doc(sdk.collection(db, 'groups'));
  const group = {
    name: name.trim() || 'Untitled Group',
    currency: currency || '₹',
    ownerId: owner.uid,
    createdAt: sdk.serverTimestamp(),
    updatedAt: sdk.serverTimestamp()
  };
  await sdk.setDoc(groupRef, group);
  await sdk.setDoc(sdk.doc(db, 'groups', groupRef.id, 'members', owner.uid), {
    uid: owner.uid,
    name: owner.displayName || owner.email || 'Owner',
    email: owner.email || '',
    photoURL: owner.photoURL || '',
    handle: '',
    role: 'owner',
    joinedAt: sdk.serverTimestamp()
  });
  await Promise.all(members.filter(m => m.name).map(member => sdk.setDoc(
    sdk.doc(sdk.collection(db, 'groups', groupRef.id, 'members')),
    { name: member.name.trim(), email: member.email || '', handle: member.handle || '', role: 'member', uid: null, invitedAt: sdk.serverTimestamp() }
  )));
  return { id: groupRef.id, ...group };
}

/** Import a browser-local trip once. Existing local data is never modified. */
export async function importLocalTrip(localTrip, owner) {
  if (!localTrip) throw new Error('Choose a local trip to import first.');
  await initialiseSharedLedger();
  const group = await createSharedGroup({ name: localTrip.name, currency: localTrip.currency, owner, members: [] });
  const groupRef = sdk.doc(db, 'groups', group.id);
  const memberIds = {};
  const ownerName = (owner.displayName || owner.email || '').trim().toLowerCase();
  for (const localMember of localTrip.members || []) {
    if (localMember.name.trim().toLowerCase() === ownerName) {
      memberIds[localMember.name] = owner.uid;
      continue;
    }
    const memberRef = sdk.doc(sdk.collection(groupRef, 'members'));
    memberIds[localMember.name] = memberRef.id;
    await sdk.setDoc(memberRef, {
      uid: null, name: localMember.name, email: '', handle: localMember.handle || '', role: 'member',
      importedAt: sdk.serverTimestamp()
    });
  }
  for (const localExpense of localTrip.expenses || []) {
    const paidBy = memberIds[localExpense.paidBy];
    const splitBetween = (localExpense.splitBetween || []).map(name => memberIds[name]).filter(Boolean);
    if (paidBy && splitBetween.length) await addSharedExpense(group.id, {
      title: localExpense.title, amount: localExpense.amount, paidBy, splitBetween
    });
  }
  return group;
}

export function observeSharedGroups(uid, callback) {
  if (!sdk || !uid) return () => {};
  // Membership IDs are user IDs for claimed profiles; querying the member
  // collection group avoids granting a user read access to every group.
  const memberships = sdk.query(sdk.collectionGroup(db, 'members'), sdk.where('uid', '==', uid));
  return sdk.onSnapshot(memberships, async snapshot => {
    const groups = [];
    await Promise.all(snapshot.docs.map(async membershipDoc => {
      const groupRef = membershipDoc.ref.parent.parent;
      const groupDoc = await sdk.getDoc(groupRef);
      if (groupDoc.exists()) groups.push({ id: groupDoc.id, ...groupDoc.data(), membership: membershipDoc.data() });
    }));
    callback(groups);
  }, () => callback([]));
}

export function observeSharedGroup(groupId, callback) {
  if (!sdk || !groupId) return () => {};
  const groupRef = sdk.doc(db, 'groups', groupId);
  const state = { group: null, members: [], expenses: [], payments: [] };
  const emit = () => {
    if (!state.group) return callback(null);
    callback({ id: groupId, ...state.group, members: state.members, expenses: state.expenses, payments: state.payments });
  };
  const unsubs = [
    sdk.onSnapshot(groupRef, snapshot => { state.group = snapshot.exists() ? snapshot.data() : null; emit(); }),
    sdk.onSnapshot(sdk.collection(groupRef, 'members'), snapshot => { state.members = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); emit(); }),
    sdk.onSnapshot(sdk.collection(groupRef, 'expenses'), snapshot => { state.expenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); emit(); }),
    sdk.onSnapshot(sdk.collection(groupRef, 'payments'), snapshot => { state.payments = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); emit(); })
  ];
  return () => unsubs.forEach(unsubscribe => unsubscribe());
}

export async function addSharedExpense(groupId, expense) {
  await initialiseSharedLedger();
  return sdk.addDoc(sdk.collection(db, 'groups', groupId, 'expenses'), {
    title: expense.title.trim() || 'Expense', amount: Number(expense.amount), paidBy: expense.paidBy,
    splitBetween: expense.splitBetween, createdAt: sdk.serverTimestamp(), createdBy: auth.currentUser.uid
  });
}

export async function submitPayment(groupId, { from, to, amount, note = '' }) {
  await initialiseSharedLedger();
  return sdk.addDoc(sdk.collection(db, 'groups', groupId, 'payments'), {
    from, to, amount: Number(amount), note, status: 'submitted', submittedAt: sdk.serverTimestamp(),
    submittedBy: auth.currentUser.uid, updatedAt: sdk.serverTimestamp()
  });
}

export async function reviewPayment(groupId, paymentId, status) {
  await initialiseSharedLedger();
  if (!['confirmed', 'rejected'].includes(status)) throw new Error('Invalid payment status.');
  return sdk.updateDoc(sdk.doc(db, 'groups', groupId, 'payments', paymentId), {
    status, reviewedAt: sdk.serverTimestamp(), reviewedBy: auth.currentUser.uid, updatedAt: sdk.serverTimestamp()
  });
}

export async function createPaymentLink(group, route) {
  await initialiseSharedLedger();
  if (!auth.currentUser || group.ownerId !== auth.currentUser.uid) throw new Error('Only the group owner can create payment links.');
  const payee = (group.members || []).find(member => member.id === route.to) || {};
  const payer = (group.members || []).find(member => member.id === route.from) || {};
  const ref = sdk.doc(sdk.collection(db, 'paymentLinks'));
  await sdk.setDoc(ref, {
    groupId: group.id, ownerId: auth.currentUser.uid, from: route.from, to: route.to,
    fromName: payer.name || 'Member', toName: payee.name || 'Collector', upiHandle: payee.handle || '',
    amount: Number(route.amount), currency: group.currency || '₹', status: 'pending',
    createdAt: sdk.serverTimestamp(), updatedAt: sdk.serverTimestamp()
  });
  return { id: ref.id };
}

export function observePaymentLinks(ownerId, callback) {
  if (!sdk || !ownerId) return () => {};
  const links = sdk.query(sdk.collection(db, 'paymentLinks'), sdk.where('ownerId', '==', ownerId));
  return sdk.onSnapshot(links, snapshot => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
}

export function observePublicPaymentLink(linkId, callback) {
  if (!sdk || !linkId) return () => {};
  return sdk.onSnapshot(sdk.doc(db, 'paymentLinks', linkId), snapshot => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null));
}

export async function submitPublicPaymentLink(linkId) {
  await initialiseSharedLedger();
  return sdk.updateDoc(sdk.doc(db, 'paymentLinks', linkId), {
    status: 'submitted', submittedAt: sdk.serverTimestamp(), updatedAt: sdk.serverTimestamp()
  });
}

export async function confirmPaymentLink(link) {
  await initialiseSharedLedger();
  if (!auth.currentUser || link.ownerId !== auth.currentUser.uid) throw new Error('Only the group owner can confirm this payment.');
  const batch = sdk.writeBatch(db);
  batch.update(sdk.doc(db, 'paymentLinks', link.id), {
    status: 'confirmed', reviewedAt: sdk.serverTimestamp(), reviewedBy: auth.currentUser.uid, updatedAt: sdk.serverTimestamp()
  });
  batch.set(sdk.doc(sdk.collection(db, 'groups', link.groupId, 'payments')), {
    from: link.from, to: link.to, amount: Number(link.amount), status: 'confirmed',
    submittedBy: auth.currentUser.uid, reviewedBy: auth.currentUser.uid,
    submittedAt: sdk.serverTimestamp(), reviewedAt: sdk.serverTimestamp(), updatedAt: sdk.serverTimestamp(), source: 'payment-link'
  });
  return batch.commit();
}

export function calculateSharedBalances(group) {
  const totals = Object.fromEntries((group.members || []).map(member => [member.id, 0]));
  for (const expense of group.expenses || []) {
    const amount = Number(expense.amount) || 0;
    if (totals[expense.paidBy] !== undefined) totals[expense.paidBy] += amount;
    const split = (expense.splitBetween || []).filter(id => totals[id] !== undefined);
    split.forEach(id => { totals[id] -= amount / (split.length || 1); });
  }
  for (const payment of group.payments || []) {
    if (payment.status !== 'confirmed') continue;
    const amount = Number(payment.amount) || 0;
    if (totals[payment.from] !== undefined) totals[payment.from] += amount;
    if (totals[payment.to] !== undefined) totals[payment.to] -= amount;
  }
  return Object.fromEntries(Object.entries(totals).map(([id, value]) => [id, Math.round(value * 100) / 100]));
}
