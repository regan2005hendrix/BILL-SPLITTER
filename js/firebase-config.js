/**
 * Firebase project configuration.
 *
 * Replace the empty values with the Web app settings from Firebase Console
 * before deploying. Firebase Web configuration is designed to be public; the
 * Firestore rules in `firebase/firestore.rules` protect the actual data. The
 * app runs as a local-only bill splitter until Firebase is configured.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDDWEFi6mUyX08-Vkhd2Rd6fq2H3K5XaLA",
  authDomain: "bill-splitter-67097.firebaseapp.com",
  projectId: "bill-splitter-67097",
  storageBucket: "bill-splitter-67097.firebasestorage.app",
  messagingSenderId: "98776698536",
  appId: "1:98776698536:web:eee098e5980368712cbc9d",
  measurementId: "G-6YXQ3L6583"
};

export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

// This project uses the Firestore database ID `default` (not Firebase's
// conventional `(default)` ID). Keep this aligned with Firebase Console.
export const firebaseDatabaseId = 'default';
