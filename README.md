# Food India - Firebase Configuration Guide

This application uses Firebase for Authentication, Firestore (Database), and Cloud Storage.

## Prerequisites
1. A Firebase Project created in the [Firebase Console](https://console.firebase.google.com/).
2. **Authentication** enabled with Google and Email/Password providers.
3. **Firestore** database initialized in your preferred region.
4. **Storage** bucket created.

## Local Setup
The application reads configuration from `/firebase-applet-config.json`. In the AI Studio environment, this is automatically generated when you use the "Firebase Setup" tool.

### To use your own Firebase project:
1. Go to Project Settings > General in the Firebase Console.
2. Scroll down to "Your apps" and select the Web app (create one if needed).
3. Copy the `firebaseConfig` object and ensure it matches the structure in `firebase-applet-config.json`.

## Security Rules
The following rules must be deployed to your Firebase project:

### Firestore Rules
Copy the contents of `firestore.rules` into the **Firestore > Rules** tab in the Firebase Console.

### Storage Rules
Copy the following into the **Storage > Rules** tab:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /restaurants/{restaurantId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && (get(/databases/(default)/documents/restaurants/$(restaurantId)).data.sellerId == request.auth.uid);
    }
    match /products/{productId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null; // Refine based on restaurant ownership
    }
    match /sellerDocuments/{sellerId}/{allPaths=**} {
      allow read: if request.auth != null && (request.auth.uid == sellerId || get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow write: if request.auth != null && request.auth.uid == sellerId;
    }
    match /users/{userId}/profile.jpg {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Backend Schema
The database schema is defined in `firebase-blueprint.json`. This includes:
- **Users**: Central identity and roles.
- **Customers/Sellers**: Role-specific extensions.
- **Restaurants & Products**: For the marketplace.
- **Orders & Payments**: For transactions.
- **Reviews & Notifications**: For engagement.
