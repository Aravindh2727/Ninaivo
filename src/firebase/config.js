import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
const envApiKey = metaEnv.VITE_FIREBASE_API_KEY?.trim();
const envAuthDomain = metaEnv.VITE_FIREBASE_AUTH_DOMAIN?.trim();
const envProjectId = metaEnv.VITE_FIREBASE_PROJECT_ID?.trim();
const envStorageBucket = metaEnv.VITE_FIREBASE_STORAGE_BUCKET?.trim();
const envMessagingSenderId = metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
const envAppId = metaEnv.VITE_FIREBASE_APP_ID?.trim();
const envMeasurementId = metaEnv.VITE_FIREBASE_MEASUREMENT_ID?.trim();

export const isFirebaseConfigured = Boolean(
  envApiKey && 
  envProjectId && 
  envApiKey !== 'your_firebase_api_key_here' && 
  envProjectId !== 'your_project_id'
);

const firebaseConfig = {
  apiKey: isFirebaseConfigured ? envApiKey : 'AIzaSyAFitmU1G4OoX5Sbhtv6C_vMkBP7zw5itg',
  authDomain: envAuthDomain || 'diary-tracker-c888d.firebaseapp.com',
  projectId: envProjectId || 'diary-tracker-c888d',
  storageBucket: envStorageBucket || 'diary-tracker-c888d.firebasestorage.app',
  messagingSenderId: envMessagingSenderId || '867272788312',
  appId: envAppId || '1:867272788312:web:8510bb5e3c2a2b8bfe3d2d',
  measurementId: envMeasurementId || 'G-5078P8EDJ2'
};

// Initialize or retrieve Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Enforce robust browser local persistence across sessions, PWA launches, and browser restarts
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase Auth browserLocalPersistence configuration note:', err?.message || err);
  });
}

// Initialize Firestore with Persistent IndexedDB Multi-Tab Offline Caching
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;

// Initialize Firebase Analytics optionally and safely
// Guarded with opt-in to avoid unwanted 400 Bad Request calls to Installations API on custom domains
export let analytics = null;
const enableAnalytics = metaEnv.VITE_ENABLE_FIREBASE_ANALYTICS === 'true';

if (typeof window !== 'undefined' && enableAnalytics && firebaseConfig.measurementId) {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch((err) => {
    // Analytics is non-critical (e.g. ad-blocker, private browsing, or API restrictions)
    console.warn('Firebase Analytics initialization skipped:', err?.message || err);
  });
}

export default app;
