# OrienteerPro - Deployment Guide

## 🚀 Production Deployment

This guide will walk you through deploying OrienteerPro to production using Firebase and Vercel.

---

## Prerequisites

Before deploying, ensure you have:
- Node.js 18+ installed
- Firebase account (free tier works)
- Vercel account (free tier works)
- Git repository for the project

---

## Part 1: Firebase Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `orienteerpro` (or your choice)
4. Disable Google Analytics (optional)
5. Click "Create project"

### Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Email/Password**:
   - Click "Email/Password"
   - Toggle "Enable"
   - Click "Save"
4. Enable **Google** sign-in:
   - Click "Google"
   - Toggle "Enable"
   - Enter support email
   - Click "Save"

### Step 3: Create Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Choose **Production mode** (or Start in test mode for development)
4. Select location (choose closest to your users)
5. Click "Enable"

### Step 4: Set Up Cloud Storage

1. Go to **Storage**
2. Click "Get started"
3. Start in **Production mode**
4. Select same location as Firestore
5. Click "Done"

### Step 5: Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps"
3. Click **Web app** icon (`</>`)
4. Register app name: `OrienteerPro`
5. **Copy the configuration object:**

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123"
};
```

### Step 6: Configure Firestore Security Rules

In Firestore, go to **Rules** tab and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId) || isAdmin();
    }
    
    // Events (public read, admin write)
    match /events/{eventId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Entries
    match /entries/{entryId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
    
    // Results (public read after published)
    match /results/{resultId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Tracks (owner only)
    match /tracks/{trackId} {
      allow read, write: if isOwner(resource.data.userId);
    }
    
    // Courses
    match /courses/{courseId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Maps
    match /maps/{mapId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Club configurations (admin only)
    match /clubs/{clubId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

### Step 7: Configure Storage Rules

In Storage, go to **Rules** tab:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Maps - public read, admin write
    match /maps/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && 
                     request.auth.token.role == 'admin';
    }
    
    // Tracks - owner only
    match /tracks/{userId}/{allPaths=**} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Results
    match /results/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null &&
                     request.auth.token.role == 'admin';
    }
  }
}
```

---

## Part 2: Project Configuration

### Step 1: Create Environment Variables

Create `.env.local` in project root:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc123

# Eventor API (optional - can be configured in admin panel)
NEXT_PUBLIC_EVENTOR_API_BASE=https://eventor.orientering.se/api

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Step 2: Update Firebase Config

The app will automatically use environment variables. No code changes needed!

---

## Part 3: Deploy to Vercel

### Option A: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### Option B: Deploy via GitHub

1. Push code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** ./
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
6. Add environment variables from `.env.local`
7. Click "Deploy"

### Step 3: Configure Custom Domain (Optional)

1. In Vercel project settings, go to **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions

---

## Part 4: Post-Deployment Setup

### Step 1: Create Admin User

1. Go to your deployed app
2. Register first user with email/password
3. In Firebase Console → Authentication → Users
4. Find your user, click to edit
5. Add custom claim in Firebase Console or via Admin SDK:

```javascript
// Run this in Firebase Functions or Admin SDK
admin.auth().setCustomUserClaims(uid, { role: 'admin' });
```

Or manually via Firestore:
1. Create document in `users` collection
2. Document ID = your auth UID
3. Add field: `role: "admin"`

### Step 2: Configure Eventor API

1. Login as admin
2. Go to `/admin`
3. Click **Settings** tab
4. Enter:
   - Club name
   - Eventor Organization ID
   - Eventor API key (get from Swedish Orienteering Federation)
5. Click "Save"

### Step 3: Test Core Features

- [ ] Login with Google
- [ ] Login with Email/Password
- [ ] Browse events
- [ ] Access admin panel
- [ ] Upload a map (OMAP file)
- [ ] Record GPS track
- [ ] Connect SportIdent (if hardware available)

---

## Part 5: Optional Enhancements

### Enable Firebase Hosting (Alternative to Vercel)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init hosting

# Build Next.js
npm run build
npm run export

# Deploy
firebase deploy --only hosting
```

### Set Up Cloud Functions (For Background Jobs)

```bash
firebase init functions

# Example: Auto-sync to Eventor
# functions/src/index.ts
export const syncToEventor = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    // Sync logic here
  });
```

---

## Monitoring & Analytics

### Firebase Analytics

```javascript
// lib/firebase.ts - Add analytics
import { getAnalytics } from 'firebase/analytics';

if (typeof window !== 'undefined') {
  const analytics = getAnalytics(app);
}
```

### Vercel Analytics

```javascript
// app/layout.tsx - Add Vercel Analytics
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

---

## Troubleshooting

### Issue: "Firebase not configured"
**Solution:** Verify `.env.local` exists with all Firebase variables

### Issue: "Module not found: firebase/app"
**Solution:** Run `npm install firebase`

### Issue: "Service Worker not registering"
**Solution:** 
- Ensure running on HTTPS (localhost or production)
- Check browser console for errors
- Verify `/sw.js` is accessible

### Issue: "Build fails on Vercel"
**Solution:**
- Check build logs
- Ensure all dependencies in `package.json`
- Verify environment variables are set in Vercel

### Issue: "Can't access /admin"
**Solution:**
- Verify user has `role: "admin"` in Firestore `users` collection
- Clear cookies and re-login

---

## Performance Optimization

### Enable Compression

Vercel automatically gzips responses. For Firebase Hosting:

```json
// firebase.json
{
  "hosting": {
    "headers": [{
      "source": "**/*.@(js|css)",
      "headers": [{
        "key": "Cache-Control",
        "value": "max-age=31536000"
      }]
    }]
  }
}
```

### Image Optimization

Use Next.js Image component:

```tsx
import Image from 'next/image';

<Image src="/map.jpg" width={800} height={600} alt="Map" />
```

---

## Security Checklist

- [x] Firestore security rules configured
- [x] Storage security rules configured
- [x] Environment variables not committed to Git
- [x] HTTPS enabled (automatic on Vercel)
- [x] CSP headers configured (optional)
- [ ] Rate limiting on API routes (consider Vercel Edge Config)

---

## Support & Maintenance

### Backup Strategy

Firebase automatically backs up Firestore. For extra safety:

```bash
# Export Firestore data
gcloud firestore export gs://[BUCKET_NAME]/[EXPORT_FOLDER]
```

### Update Deployment

```bash
# Pull latest code
git pull origin main

# Rebuild and deploy
vercel --prod
```

---

## 🎉 Deployment Complete!

Your OrienteerPro app is now live!

**Next Steps:**
1. Share app URL with beta testers
2. Monitor Firebase usage
3. Collect user feedback
4. Iterate and improve

**URLs to bookmark:**
- App: https://your-app.vercel.app
- Firebase Console: https://console.firebase.google.com
- Vercel Dashboard: https://vercel.com/dashboard

---

*Last updated: 2025-12-13*
