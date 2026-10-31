# BILL-SPLITTER

Tabby is a static bill splitter with local Quick Split and trip-ledger modes.

## Shared profiles and verified payments

The shared ledger is Firebase-backed and remains disabled until configured. It
adds Google/passwordless-email sign-in, private groups, real-time balances,
and shareable payment links. A link opens the current amount due; the payer
submits payment and the group owner confirms it.

1. Create a Firebase project, register a Web App, and create a **Cloud
   Firestore** database (Standard edition, Production mode).
2. Enable **Google** and **Email link (passwordless)** providers in Firebase
   Authentication. Add your Vercel URL to Authentication's authorized domains.
3. Put the Firebase Web App values in `js/firebase-config.js`.
4. Install and authenticate the Firebase CLI, then deploy the Firestore rules:

   ```powershell
   firebase deploy --only firestore:rules
   ```

5. Deploy this repository to Vercel as a static site; no build command is
   required. Add the Vercel production URL to Firebase Authentication's
   authorized domains after the first deployment.

Firestore rules live in `firebase/firestore.rules`. No Cloud Functions or
Firebase billing are required. Existing browser-local trips are not modified
and can be imported from the Shared Groups panel after sign-in.
