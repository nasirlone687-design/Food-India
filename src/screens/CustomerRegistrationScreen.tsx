import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  MapPin,
  Navigation,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { authService } from '../services/auth';
import { User } from '../models/types';
import { useAuth } from '../context/AuthContext';
import { CopiableErrorAlert } from '../context/ErrorLogContext';
import { requestLiveGpsLocation, getGoogleMapsCoordUrl } from '../utils/gps';

const CustomerRegistrationScreen: React.FC = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [deviceGps, setDeviceGps] = useState<{
    latitude: number;
    longitude: number;
    address: string;
    googleMapsUrl: string;
  } | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureDeviceGps = async () => {
    setLocatingGps(true);
    try {
      const gps = await requestLiveGpsLocation();
      setDeviceGps({
        latitude: gps.latitude,
        longitude: gps.longitude,
        address: gps.address,
        googleMapsUrl: gps.googleMapsUrl || getGoogleMapsCoordUrl(gps.latitude, gps.longitude),
      });
    } catch {
      setDeviceGps(null);
    } finally {
      setLocatingGps(false);
    }
  };

  useEffect(() => {
    captureDeviceGps();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy to register.');
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

      const profile: Partial<User> = {
        uid,
        fullName: formData.name.trim(),
        email: cleanEmail,
        phone: formData.phone.trim(),
        role: 'customer',
      };
      await authService.createUserProfile(profile);

      const now = serverTimestamp();
      const gpsRecord = deviceGps
        ? {
            ...deviceGps,
            updatedAt: new Date().toISOString(),
          }
        : undefined;

      await setDoc(
        doc(db, 'users', uid),
        {
          fullName: formData.name.trim(),
          phone: formData.phone.trim(),
          role: 'customer',
          accountStatus: 'active',
          acceptedTermsAt: now,
          ...(gpsRecord ? { liveGps: gpsRecord } : {}),
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, 'customers', uid),
        {
          fullName: formData.name.trim(),
          email: cleanEmail,
          phone: formData.phone.trim(),
          acceptedTermsAt: now,
          ...(gpsRecord ? { liveGps: gpsRecord } : {}),
          updatedAt: now,
        },
        { merge: true }
      );

      await refreshProfile();
      navigate('/customer');
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
          onClick={() => navigate('/customer-auth')}
          className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm"
        >
          <ChevronLeft className="text-slate-900" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Create Account</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full pb-10">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">Join Food India</h2>
          <p className="text-slate-500 text-xs sm:text-sm">
            Order delicious food from the closest local kitchens near you.
          </p>
        </div>

        <CopiableErrorAlert error={error} className="mb-5" />

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-orange-500 transition-colors text-sm font-medium"
                placeholder="John Doe"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-orange-500 transition-colors text-sm font-medium"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">
              Mobile Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-orange-500 transition-colors text-sm font-medium"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          {/* Device Location Access Section */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Device GPS Location Access
                </span>
              </div>
              <button
                type="button"
                onClick={captureDeviceGps}
                disabled={locatingGps}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
              >
                {locatingGps ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Navigation size={12} />
                )}
                <span>{deviceGps ? 'Refresh GPS' : 'Allow Location'}</span>
              </button>
            </div>
            {deviceGps ? (
              <div className="text-xs bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span className="truncate font-medium">
                    {deviceGps.address} ({deviceGps.latitude.toFixed(4)}, {deviceGps.longitude.toFixed(4)})
                  </span>
                </div>
                <a
                  href={deviceGps.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-0.5 shrink-0"
                >
                  <ExternalLink size={11} /> Maps
                </a>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Allow location access so we can show the nearest dishes and closest restaurants first.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-orange-500 transition-colors text-sm font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full h-13 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-orange-500 transition-colors text-sm font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Mandatory Terms & Privacy Consent */}
          <label className="flex items-start gap-3 p-3.5 bg-white rounded-2xl border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-orange-500 rounded shrink-0"
            />
            <span className="text-xs text-slate-600 font-medium leading-relaxed">
              I agree to the Food India{' '}
              <Link to="/terms" className="text-orange-600 font-black hover:underline">
                Terms & Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-orange-600 font-black hover:underline">
                Privacy Policy
              </Link>
              , and consent to sharing my device GPS location for nearby food discovery & delivery.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-orange-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 mt-2"
          >
            {loading ? 'CREATING ACCOUNT...' : 'REGISTER'}
          </button>
        </form>

        <p className="text-center mt-6 text-slate-500 font-medium text-sm">
          Already have an account?{' '}
          <Link to="/customer-auth" className="text-orange-600 font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default CustomerRegistrationScreen;
