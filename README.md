# Teacher Tracker App

A production-grade mobile app for travelling teachers to track lessons, attendance, and monthly statistics. Built with React Native (Expo), TypeScript, and Firebase.

## Features

- **Role-based Access:** Super Admin, Admin, Teacher, Pending.
- **Offline-first:** Optimistic UI updates and background synchronization.
- **Lesson Tracking:** Schedule viewing, attendance marking (Present/Absent).
- **History:** View past lessons and monthly totals (Hours, Distance).
- **Admin Panel:** Approve teachers, view teacher data.

## Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Firebase Configuration:**
   - Create a Firebase project.
   - Enable Authentication (Email/Password).
   - Enable Firestore Database.
   - Copy your firebase configuration keys.
   - Create a `.env` file (or update `src/lib/firebase.ts` directly for testing) with:
     ```
     EXPO_PUBLIC_FIREBASE_API_KEY=...
     EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
     EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
     EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
     EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
     EXPO_PUBLIC_FIREBASE_APP_ID=...
     ```

3. **Firestore Rules:**
   - Deploy `firestore.rules` to your Firebase project to secure data.

4. **Super Admin Setup:**
   - Update `src/utils/constants.ts` and add your email to `SUPER_ADMIN_EMAILS` to be auto-promoted to Super Admin upon registration.

## Running the App

```bash
npx expo start
```

## Testing Offline Mode

1. Open the app and load your data.
2. Turn off your device's network (Airplane mode).
3. Mark attendance or add a lesson. (Changes reflect instantly).
4. Turn on network.
5. Data will sync to Firestore in the background.

## Directory Structure

- `app/`: Expo Router screens.
- `src/components/`: Reusable UI components.
- `src/contexts/`: React Contexts (Auth, Lesson, Theme).
- `src/lib/`: Firebase configuration.
- `src/types/`: TypeScript definitions.
- `src/utils/`: Constants and helpers.
