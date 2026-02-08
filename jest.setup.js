import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
    useRouter() {
        return {
            push: jest.fn(),
            replace: jest.fn(),
            prefetch: jest.fn(),
        };
    },
    usePathname() {
        return '';
    },
    useSearchParams() {
        return new URLSearchParams();
    },
}));

// Mock Firebase
jest.mock('firebase/app', () => ({
    initializeApp: jest.fn(() => ({})),
    getApps: jest.fn(() => []),
}));

jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => {
    const actual = jest.requireActual('firebase/firestore');
    return {
        ...actual,
        getFirestore: jest.fn(() => ({})),
    };
});

jest.mock('firebase/storage', () => {
    const actual = jest.requireActual('firebase/storage');
    return {
        ...actual,
        getStorage: jest.fn(() => ({})),
    };
});

// Mock Geolocation API
global.navigator.geolocation = {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
};

// Mock IndexedDB
try {
    require('fake-indexeddb/auto');
} catch {
    const noopRequest = () => ({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: null,
    });

    global.indexedDB = {
        open: jest.fn(() => noopRequest()),
        deleteDatabase: jest.fn(() => noopRequest()),
    };
}
