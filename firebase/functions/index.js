const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { randomBytes } = require('crypto');

admin.initializeApp();
const db = admin.firestore();

exports.createInvite = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to create an invite.');
  const { groupId, email = '', memberId = '' } = request.data || {};
  if (!groupId) throw new HttpsError('invalid-argument', 'A group is required.');
  const membership = await db.doc(`groups/${groupId}/members/${request.auth.uid}`).get();
  if (!membership.exists || membership.data().role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only the group owner can invite members.');
  }
  if (memberId) {
    const member = await db.doc(`groups/${groupId}/members/${memberId}`).get();
    if (!member.exists || member.data().uid) throw new HttpsError('failed-precondition', 'Choose an unclaimed member.');
  }
  const token = randomBytes(32).toString('base64url');
  await db.doc(`groups/${groupId}/invites/${token}`).set({
    email: String(email).trim().toLowerCase(), createdBy: request.auth.uid,
    memberId: String(memberId || ''), createdAt: admin.firestore.FieldValue.serverTimestamp(), usedAt: null, usedBy: null
  });
  return { token };
});

exports.redeemInvite = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before redeeming an invite.');
  const { token } = request.data || {};
  if (!token || typeof token !== 'string') throw new HttpsError('invalid-argument', 'A valid invite token is required.');
  const inviteQuery = await db.collectionGroup('invites').where(admin.firestore.FieldPath.documentId(), '==', token).limit(1).get();
  if (inviteQuery.empty) throw new HttpsError('not-found', 'This invite is invalid or has expired.');
  const inviteRef = inviteQuery.docs[0].ref;
  const groupRef = inviteRef.parent.parent;
  const invite = inviteQuery.docs[0].data();
  const userEmail = (request.auth.token.email || '').toLowerCase();
  if (invite.usedAt) throw new HttpsError('failed-precondition', 'This invite has already been used.');
  if (invite.email && invite.email !== userEmail) throw new HttpsError('permission-denied', 'This invite belongs to a different email address.');

  await db.runTransaction(async transaction => {
    const current = await transaction.get(inviteRef);
    if (!current.exists || current.data().usedAt) throw new HttpsError('failed-precondition', 'This invite has already been used.');
    const membershipRef = groupRef.collection('members').doc(request.auth.uid);
    let existingMember = {};
    if (invite.memberId) {
      const placeholderRef = groupRef.collection('members').doc(invite.memberId);
      const placeholder = await transaction.get(placeholderRef);
      if (!placeholder.exists || placeholder.data().uid) throw new HttpsError('failed-precondition', 'The invited member is no longer available.');
      existingMember = placeholder.data();
      transaction.delete(placeholderRef);
    }
    transaction.set(membershipRef, {
      ...existingMember, uid: request.auth.uid, name: existingMember.name || request.auth.token.name || userEmail.split('@')[0] || 'Member',
      email: userEmail, photoURL: request.auth.token.picture || '', handle: existingMember.handle || '', role: 'member',
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.update(inviteRef, { usedAt: admin.firestore.FieldValue.serverTimestamp(), usedBy: request.auth.uid });
  });
  return { groupId: groupRef.id };
});
