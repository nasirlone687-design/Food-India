import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase/config';
import { User } from '../models/types';
import { reportGlobalButtonStatus } from '../context/ErrorLogContext';
import { v4 as uuidv4 } from 'uuid';

const BOOTSTRAPPED_ADMIN_EMAILS = ['nnasir.lone1@gmail.com'];

function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return BOOTSTRAPPED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export const authService = {
  // Get profile from Firestore
  async getUserProfile(uid: string): Promise<User | null> {
    const path = `users/${uid}`;
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  // Create profile in Firestore
  async createUserProfile(profile: Partial<User>, createDefaultRestaurant = false): Promise<void> {
    if (!profile.uid) throw new Error('UID is required to create a profile');
    const path = `users/${profile.uid}`;
    try {
      const now = serverTimestamp();
      const fullProfile = {
        uid: profile.uid,
        fullName: profile.fullName || 'User',
        email: profile.email || '',
        phone: profile.phone || '',
        role: profile.role || 'customer',
        photoURL: profile.photoURL || '',
        accountStatus: 'active',
        registrationDate: now, // Immutable after creation
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };
      await setDoc(doc(db, 'users', profile.uid), fullProfile, { merge: true });

      // Create secondary collection record based on role
      if (profile.role === 'customer') {
        await setDoc(doc(db, 'customers', profile.uid), {
          uid: profile.uid,
          phone: profile.phone || '',
          savedAddresses: [],
          orderIds: [],
          totalOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          createdAt: now,
          updatedAt: now,
        }, { merge: true });
      } else if (profile.role === 'seller') {
        const restaurantId = createDefaultRestaurant ? uuidv4() : undefined;
        await setDoc(doc(db, 'sellers', profile.uid), {
          sellerId: profile.uid,
          uid: profile.uid,
          ownerName: profile.fullName || 'Seller Partner',
          businessPhone: profile.phone || '',
          ...(restaurantId ? { restaurantId } : {}),
          verificationStatus: 'pending',
          subscriptionStatus: 'inactive',
          registrationDate: now,
          createdAt: now,
          updatedAt: now,
        }, { merge: true });

        if (createDefaultRestaurant && restaurantId) {
          await setDoc(doc(db, 'restaurants', restaurantId), {
            restaurantId,
            sellerId: profile.uid,
            restaurantName: `${profile.fullName || 'New'}'s Kitchen`,
            description: 'Freshly prepared authentic Indian dishes.',
            phone: profile.phone || '',
            email: profile.email || '',
            address: 'Srinagar, Jammu & Kashmir, India',
            state: 'Jammu and Kashmir',
            city: 'Srinagar',
            district: 'Srinagar',
            pincode: '190001',
            latitude: 34.0837,
            longitude: 74.7973,
            googleMapsLink: 'https://www.google.com/maps/dir/?api=1&destination=34.0837,74.7973',
            openingHours: { open: '09:00', close: '22:00' },
            isOpen: true,
            preparationTime: '25-35 mins',
            allowOwnDeliveryStaff: true,
            deliveryPricingMode: 'base_km',
            baseDeliveryCharge: 20,
            deliveryPricePerKm: 5,
            deliveryRanges: [
              { minKm: 0, maxKm: 3, price: 25 },
              { minKm: 3, maxKm: 7, price: 45 },
              { minKm: 7, maxKm: 15, price: 70 },
            ],
            maximumDeliveryDistanceKm: 15,
            approvalStatus: 'approved',
            createdAt: now,
            updatedAt: now,
          }, { merge: true });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Google Sign In for Customer / Seller / Admin
  async signInWithGoogle(role: 'customer' | 'seller' | 'admin'): Promise<User> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      let profile = await this.getUserProfile(firebaseUser.uid);

      if (role === 'admin') {
        const isBootstrappedAdmin = isAuthorizedAdminEmail(firebaseUser.email);

        if (!isBootstrappedAdmin) {
          await this.logout();
          throw new Error('Unauthorized access. Only the authorized system administrator can enter.');
        }

        if (!profile) {
          const now = serverTimestamp();
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            uid: firebaseUser.uid,
            fullName: firebaseUser.displayName || 'System Administrator',
            email: firebaseUser.email || '',
            phone: firebaseUser.phoneNumber || '',
            photoURL: firebaseUser.photoURL || '',
            role: 'admin',
            accountStatus: 'active',
            registrationDate: now,
            createdAt: now,
            updatedAt: now,
            lastLoginAt: now,
          }, { merge: true });
          profile = await this.getUserProfile(firebaseUser.uid);
        } else if (profile.role !== 'admin') {
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            role: 'admin',
            accountStatus: 'active',
            updatedAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          });
          profile = await this.getUserProfile(firebaseUser.uid);
        }

        if (!profile || profile.role !== 'admin') {
          await this.logout();
          throw new Error('Unauthorized access. Server-controlled administrator permissions required.');
        }

        return profile;
      }

      if (!profile) {
        const newProfile: Partial<User> = {
          uid: firebaseUser.uid,
          fullName: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          phone: firebaseUser.phoneNumber || '',
          photoURL: firebaseUser.photoURL || '',
          role,
        };
        await this.createUserProfile(newProfile, role === 'seller');
        profile = (await this.getUserProfile(firebaseUser.uid)) as User;
      } else if (profile.role !== role && profile.role !== 'admin') {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          role,
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
        if (role === 'seller') {
          await this.createUserProfile({ ...profile, role: 'seller' }, true);
        } else {
          await this.createUserProfile({ ...profile, role: 'customer' }, false);
        }
        profile = (await this.getUserProfile(firebaseUser.uid)) as User;
      } else {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          accountStatus: 'active',
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
      }

      if (profile.accountStatus === 'suspended') {
        await this.logout();
        throw new Error('Your account has been suspended by the administrator.');
      }

      return profile;
    } catch (error) {
      console.error('Google Auth Error:', error);
      throw error;
    }
  },

  // Email Sign In (with automatic profile & first-time account provisioning if not yet registered)
  async signIn(email: string, pass: string, expectedRole: 'customer' | 'seller' = 'customer'): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      let firebaseUser;
      try {
        const result = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        firebaseUser = result.user;
      } catch (signInErr: any) {
        const errCode = signInErr?.code || '';
        if (
          pass.length >= 6 &&
          (errCode === 'auth/user-not-found' ||
            errCode === 'auth/invalid-credential' ||
            errCode === 'auth/invalid-login-credentials')
        ) {
          try {
            const created = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
            firebaseUser = created.user;
          } catch (createErr: any) {
            if (createErr?.code === 'auth/email-already-in-use') {
              // Automatically open Google Sign-In fallback if email is linked to Google or has another password
              const popupRes = await signInWithPopup(auth, googleProvider);
              firebaseUser = popupRes.user;
            } else {
              throw createErr;
            }
          }
        } else {
          throw signInErr;
        }
      }

      let profile = await this.getUserProfile(firebaseUser.uid);
      if (!profile) {
        const inferredName = cleanEmail.split('@')[0]?.replace(/[._-]/g, ' ') || 'Food India User';
        await this.createUserProfile(
          {
            uid: firebaseUser.uid,
            fullName: inferredName.charAt(0).toUpperCase() + inferredName.slice(1),
            email: firebaseUser.email || cleanEmail,
            phone: firebaseUser.phoneNumber || '',
            role: expectedRole,
          },
          expectedRole === 'seller'
        );
        profile = await this.getUserProfile(firebaseUser.uid);
      }

      if (!profile) throw new Error('User profile could not be loaded.');

      if (profile.accountStatus === 'suspended') {
        await this.logout();
        throw new Error('Your account has been suspended by the administrator.');
      }

      // If user logs into Seller portal or Customer portal, ensure role matches or upgrade if needed
      if (expectedRole && profile.role !== expectedRole && profile.role !== 'admin') {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          role: expectedRole,
          accountStatus: 'active',
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
        if (expectedRole === 'seller') {
          await this.createUserProfile({ ...profile, role: 'seller' }, true);
        } else {
          await this.createUserProfile({ ...profile, role: 'customer' }, false);
        }
        profile = (await this.getUserProfile(firebaseUser.uid)) || { ...profile, role: expectedRole };
      } else {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          accountStatus: 'active',
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
      }

      reportGlobalButtonStatus({
        buttonName: `${expectedRole === 'seller' ? 'Seller' : 'Customer'} Sign In`,
        backendPath: `Firestore: users/${firebaseUser.uid}`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Signed in (${profile.role}).`,
      });

      return profile;
    } catch (error: any) {
      reportGlobalButtonStatus({
        buttonName: `${expectedRole === 'seller' ? 'Seller' : 'Customer'} Sign In`,
        backendPath: `Firebase Auth & users`,
        dbUpdated: 'NOT_UPDATED',
        statusType: 'error',
        message: error?.message || 'Sign in failed.',
        suggestion: 'Enter your registered email and password (min 6 characters) or continue with Google.',
      });
      throw error;
    }
  },

  // Dedicated Admin Portal Sign In (strictly locked to single authorized admin email, never exposes email)
  async signInAdmin(email: string, pass: string): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();
    if (!isAuthorizedAdminEmail(cleanEmail)) {
      throw new Error('Unauthorized access. Only the authorized system administrator can enter.');
    }

    try {
      let firebaseUser;
      try {
        const result = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        firebaseUser = result.user;
      } catch (signInErr: any) {
        try {
          const created = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
          firebaseUser = created.user;
        } catch (createErr: any) {
          if (createErr?.code === 'auth/email-already-in-use') {
            // Account already exists in Firebase Auth (e.g. via Google or earlier password) — authenticate seamlessly via Google popup
            const popupResult = await signInWithPopup(auth, googleProvider);
            if (!isAuthorizedAdminEmail(popupResult.user.email)) {
              await this.logout();
              throw new Error('Unauthorized access. Only the authorized system administrator can enter.');
            }
            firebaseUser = popupResult.user;
          } else {
            throw signInErr;
          }
        }
      }

      let profile = await this.getUserProfile(firebaseUser.uid);
      const isAuthorized = isAuthorizedAdminEmail(firebaseUser.email || cleanEmail);

      if (!isAuthorized) {
        await this.logout();
        throw new Error('Unauthorized access. Only the authorized system administrator can enter.');
      }

      if (!profile) {
        const now = serverTimestamp();
        await setDoc(
          doc(db, 'users', firebaseUser.uid),
          {
            uid: firebaseUser.uid,
            fullName: 'Food India System Admin',
            email: cleanEmail,
            phone: '',
            role: 'admin',
            accountStatus: 'active',
            registrationDate: now,
            createdAt: now,
            updatedAt: now,
            lastLoginAt: now,
          },
          { merge: true }
        );
        profile = await this.getUserProfile(firebaseUser.uid);
      } else if (profile.role !== 'admin') {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          role: 'admin',
          accountStatus: 'active',
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
        profile = await this.getUserProfile(firebaseUser.uid);
      }

      if (!profile || profile.role !== 'admin') {
        await this.logout();
        throw new Error('Unauthorized access. Only the authorized system administrator can enter.');
      }

      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        accountStatus: 'active',
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      reportGlobalButtonStatus({
        buttonName: 'Admin Portal Login',
        backendPath: `users/${firebaseUser.uid}`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: 'Administrator authenticated via Firebase Auth.',
        suggestion: 'Admin Command Center unlocked.',
      });

      return profile;
    } catch (error: any) {
      reportGlobalButtonStatus({
        buttonName: 'Admin Portal Login',
        backendPath: 'users/{adminUid}',
        dbUpdated: 'NOT_UPDATED',
        statusType: 'error',
        message: error?.message || 'Admin login failed.',
        suggestion: 'Verify administrator credentials or sign in with Google Auth.',
      });
      throw error;
    }
  },

  // Deactivate Customer or Seller Account while permanently preserving all records in Firestore
  async deleteAccount(uid: string, role?: 'customer' | 'seller' | 'admin'): Promise<void> {
    try {
      const now = serverTimestamp();
      if (role === 'customer') {
        await setDoc(
          doc(db, 'customers', uid),
          { accountStatus: 'deactivated', deactivatedAt: now, updatedAt: now },
          { merge: true }
        ).catch(() => {});
      } else if (role === 'seller') {
        await setDoc(
          doc(db, 'sellers', uid),
          { accountStatus: 'deactivated', accountPaused: true, deactivatedAt: now, updatedAt: now },
          { merge: true }
        ).catch(() => {});
      }
      await setDoc(
        doc(db, 'users', uid),
        { accountStatus: 'deactivated', deactivatedAt: now, updatedAt: now },
        { merge: true }
      ).catch(() => {});

      await firebaseSignOut(auth);
    } catch (err) {
      await firebaseSignOut(auth);
      throw err;
    }
  },

  // Sign Out
  async logout(): Promise<void> {
    await firebaseSignOut(auth);
  },
};

