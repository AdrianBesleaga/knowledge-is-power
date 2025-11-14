import admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

export const initFirebase = (): admin.app.App => {
  if (firebaseApp) {
    return firebaseApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase credentials are not configured. Please check FIREBASE_* variables in .env');
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return firebaseApp;
};

export const getFirebaseAuth = (): admin.auth.Auth => {
  if (!firebaseApp) {
    initFirebase();
  }
  return admin.auth();
};

