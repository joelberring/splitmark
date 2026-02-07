/**
 * Firebase Configuration
 * Cloud services for real-time sync and backend
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Firebase configuration
// TODO: Replace with actual Firebase project credentials
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-key',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'demo-app-id',
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let storage: FirebaseStorage;

if (typeof window !== 'undefined') {
    // Only initialize on client side
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApps()[0];
    }

    auth = getAuth(app);
    firestore = getFirestore(app);
    storage = getStorage(app);
}

export { app, auth, firestore, storage };

// ============= Firestore Collections =============

export const COLLECTIONS = {
    EVENTS: 'events',
    ENTRIES: 'entries',
    RESULTS: 'results',
    COURSES: 'courses',
    TRACKING: 'tracking',
    USERS: 'users',
    SEGMENTS: 'segments',
    EFFORTS: 'efforts',
} as const;

// ============= Helper Functions =============

/**
 * Check if Firebase is properly configured
 */
export function isFirebaseConfigured(): boolean {
    const isConfigured = !!(
        firebaseConfig.apiKey &&
        firebaseConfig.apiKey !== 'demo-key' &&
        firebaseConfig.projectId &&
        firebaseConfig.projectId !== 'demo-project' &&
        firebaseConfig.projectId !== 'your-project-id'
    );

    if (!isConfigured && typeof window !== 'undefined') {
        console.warn('Firebase is NOT configured for cloud storage. Falling back to local/demo mode.');
    } else if (isConfigured && typeof window !== 'undefined') {
        process.env.NODE_ENV !== 'production' && console.log('Firebase Cloud Storage is active.');
    }

    return isConfigured;
}
