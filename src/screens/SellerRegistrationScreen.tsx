import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Mail, Lock, User as UserIcon, Phone, Store } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider } from '../firebase/config';
import { authService } from '../services/auth';
import { User } from '../models/types';
import { LocationPicker } from '../components/LocationPicker';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { CopiableErrorAlert } from '../context/ErrorLogContext';

const SellerRegistrationScreen: React.FC = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [formData, setFormData] = useState({
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    restaurantName: '',
    restaurantPhone: '',
  });
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
    googleMapsLink: string;
  } | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!location) {
      setError('Please allow device GPS or select your restaurant location on the map.');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms & Conditions, Privacy Policy, and ₹499/30d Subscription Terms.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cleanEmail = formData.email.trim().toLowerCase();
      let uid = '';
      try {
        const result = await createUserWithEmailAndPassword(auth, cleanEmail, formData.password);
        uid = result.user.uid;
      } catch (createErr: any) {
        if (createErr?.code === 'auth/email-already-in-use') {
          try {
            const signedIn = await signInWithEmailAndPassword(auth, cleanEmail, formData.password);
            uid = signedIn.user.uid;
          } catch {
            const popupRes = await signInWithPopup(auth, googleProvider);
            uid = popupRes.user.uid;
          }
        } else {
          throw createErr;
        }
      }

      const restaurantId = uuidv4();
      const now = serverTimestamp();

      const profile: Partial<User> = {
        uid,
        fullName: formData.ownerName.trim(),
        email: cleanEmail,
        phone: formData.phone.trim(),
        role: 'seller',
      };

      // 1. Create User Profile & Seller Record
      await authService.createUserProfile(profile);

      // 2. Create Restaurant Record
      await setDoc(doc(db, 'restaurants', restaurantId), {
        restaurantId,
        sellerId: uid,
        restaurantName: formData.restaurantName.trim(),
        phone: formData.restaurantPhone.trim() || formData.phone.trim(),
        email: cleanEmail,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
        googleMapsLink: location.googleMapsLink,
        isOpen: true,
        approvalStatus: 'approved',
        rating: 4.7,
        totalReviews: 12,
        deliveryPricingMode: 'base_km',
        baseDeliveryCharge: 25,
        deliveryPricePerKm: 8,
        openingHours: {
          monday: { open: '09:00', close: '22:00', isClosed: false },
          tuesday: { open: '09:00', close: '22:00', isClosed: false },
          wednesday: { open: '09:00', close: '22:00', isClosed: false },
          thursday: { open: '09:00', close: '22:00', isClosed: false },
          friday: { open: '09:00', close: '23:00', isClosed: false },
          saturday: { open: '09:00', close: '23:00', isClosed: false },
          sunday: { open: '10:00', close: '22:00', isClosed: false },
        },
        createdAt: now,
        updatedAt: now,
      });

      // 3. Update Seller & User with restaurantId, liveGps, and acceptedTermsAt
      const gpsRecord = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        googleMapsUrl: location.googleMapsLink,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(
        doc(db, 'sellers', uid),
        {
          restaurantId,
          latitude: location.latitude,
          longitude: location.longitude,
          googleMapsLink: location.googleMapsLink,
          acceptedTermsAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, 'users', uid),
        {
          role: 'seller',
          accountStatus: 'active',
          liveGps: gpsRecord,
          acceptedTermsAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await refreshProfile();
      navigate('/seller/subscription');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 flex flex-col overflow-x-hidden max-w-[100vw]">
      <header className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => navigate('/seller-auth')}
          className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm"
        >
          <ChevronLeft className="text-slate-900" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Partner with Us</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full pb-10">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">Register Kitchen</h2>
          <p className="text-slate-500 text-xs sm:text-sm">
            0% Commission • Flat ₹499 / 30 Days Subscription via UPI 8825018335@axl
          </p>
        </div>

        <CopiableErrorAlert error={error} className="mb-6" />

        <form onSubmit={handleRegister} className="space-y-5">
          {/* Owner Details Section */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
              Owner Details
            </h3>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 ml-1">Owner Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleChange}
                  required
                  className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-red-600 transition-colors text-sm font-medium"
                  placeholder="Owner's Full Name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 ml-1">Business Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-red-600 transition-colors text-sm font-medium"
                  placeholder="owner@restaurant.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 ml-1">Personal Phone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-red-600 transition-colors text-sm font-medium"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </div>

          {/* Restaurant Details Section */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
              Restaurant & Live GPS Location
            </h3>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 ml-1">Restaurant Name</label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  name="restaurantName"
                  value={formData.restaurantName}
                  onChange={handleChange}
                  required
                  className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-red-600 transition-colors text-sm font-medium"
                  placeholder="The Spice Garden"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 ml-1">Restaurant Phone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="tel"
                  name="restaurantPhone"
                  value={formData.restaurantPhone}
                  onChange={handleChange}
                  required
                  className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-red-600 transition-colors text-sm font-medium"
                  placeholder="Landline or Business Mobile"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 ml-1">
                Device GPS & Kitchen Map Location
              </label>
              <div className="bg-white p-1 rounded-2xl border border-slate-200">
                <LocationPicker
                  label="Allow Device GPS or Search Kitchen Location"
                  onLocationSelect={(loc) => setLocation(loc)}
                  autoLocate={true}
                />
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="space-y-3.5 pt-3 border-t border-slate-200">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 ml-1">Create Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-red-600 transition-colors text-sm font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 ml-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-red-600 transition-colors text-sm font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* Mandatory Terms, Privacy & GPS Consent */}
          <label className="flex items-start gap-3 p-3.5 bg-white rounded-2xl border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-red-600 rounded shrink-0"
            />
            <span className="text-xs text-slate-600 font-medium leading-relaxed">
              I agree to the Food India{' '}
              <Link to="/terms" className="text-red-600 font-black hover:underline">
                Terms & Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-red-600 font-black hover:underline">
                Privacy & Refund Policy
              </Link>{' '}
              (₹499 / 30 days subscription via UPI 8825018335@axl), and grant device GPS location access for customer distance calculation.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-red-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 mt-2"
          >
            {loading ? 'REGISTERING KITCHEN...' : 'BECOME A PARTNER'}
          </button>
        </form>

        <p className="text-center my-6 text-slate-500 font-medium text-sm">
          Already have an account?{' '}
          <Link to="/seller-auth" className="text-red-600 font-bold hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SellerRegistrationScreen;
