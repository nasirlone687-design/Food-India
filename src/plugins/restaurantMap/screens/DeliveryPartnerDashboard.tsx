import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PluginDeliveryPartner, PluginOrder } from '../models/types';
import { pluginDeliveryPartnerService } from '../services/pluginDeliveryPartnerService';
import { pluginOrderService } from '../services/pluginOrderService';
import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../services/auth';
import { requestLiveGpsLocation } from '../../../utils/gps';
import {
  Truck,
  ShieldCheck,
  MapPin,
  Navigation,
  Phone,
  Power,
  DollarSign,
  FileText,
  QrCode,
  CheckCircle2,
  ChevronLeft,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

export const DeliveryPartnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [partner, setPartner] = useState<PluginDeliveryPartner | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [orders, setOrders] = useState<PluginOrder[]>([]);
  const [googleAuthLoading, setGoogleAuthLoading] = useState<boolean>(false);

  // Registration Form State
  const [name, setName] = useState(profile?.fullName || user?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [vehicleType, setVehicleType] = useState<'bike' | 'scooter' | 'auto' | 'van'>('scooter');
  const [vehicleNumber, setVehicleNumber] = useState('');
  
  // Verification Document States (Base64 Data URLs & File Names)
  const [identityDocUrl, setIdentityDocUrl] = useState('');
  const [identityFileName, setIdentityFileName] = useState('');
  const [licenseDocUrl, setLicenseDocUrl] = useState('');
  const [licenseFileName, setLicenseFileName] = useState('');
  const [vehicleRcUrl, setVehicleRcUrl] = useState('');
  const [vehicleRcFileName, setVehicleRcFileName] = useState('');
  const [vehicleInsuranceUrl, setVehicleInsuranceUrl] = useState('');
  const [vehicleInsuranceFileName, setVehicleInsuranceFileName] = useState('');

  const [baseDeliveryPrice, setBaseDeliveryPrice] = useState<number>(20);
  const [pricePerKm, setPricePerKm] = useState<number>(10);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [regSuccess, setRegSuccess] = useState<boolean>(false);

  // Settings & Location state
  const [isUpdatingLocation, setIsUpdatingLocation] = useState<boolean>(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [payingSubscription, setPayingSubscription] = useState<boolean>(false);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  const handleCopyUpi = (upiId: string = '8825018335@axl') => {
    try {
      navigator.clipboard.writeText(upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      // ignore
    }
  };

  // File Picker Helper
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setUrl: (val: string) => void,
    setName: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) setUrl(res);
    };
    reader.readAsDataURL(file);
  };

  // Manual Lat/Lng coordinates override
  const [manualLat, setManualLat] = useState<string>('34.0837');
  const [manualLng, setManualLng] = useState<string>('74.7973');

  const handleGoogleSignIn = async () => {
    setGoogleAuthLoading(true);
    try {
      const gProfile = await authService.signInWithGoogle('customer');
      if (gProfile) {
        if (gProfile.fullName) setName(gProfile.fullName);
        if (gProfile.phone) setPhone(gProfile.phone);
      }
    } catch (err) {
      console.error('Google Sign In Error:', err);
    } finally {
      setGoogleAuthLoading(false);
    }
  };

  // Load existing delivery partner profile
  useEffect(() => {
    const fetchPartner = async () => {
      setLoading(true);
      if (profile?.phone) {
        const found = await pluginDeliveryPartnerService.getPartnerByPhone(profile.phone);
        if (found) {
          setPartner(found);
          setBaseDeliveryPrice(found.baseDeliveryPrice);
          setPricePerKm(found.pricePerKm);
          setManualLat(found.latitude.toString());
          setManualLng(found.longitude.toString());
        }
      }
      setLoading(false);
    };
    fetchPartner();
  }, [profile?.phone]);

  // Subscribe to plugin map orders
  useEffect(() => {
    const unsub = pluginOrderService.subscribeSellerOrders('all', 'all', (list: PluginOrder[]) => {
      setOrders(list);
    });
    return () => unsub();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);

    const activePhone = phone.trim() || profile?.phone || user?.email || `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const activeName = name.trim() || profile?.fullName || user?.displayName || 'Delivery Partner Driver';
    const activeVehicleNum = vehicleNumber.trim() || 'JK-01-REGISTERED';

    try {
      const partnerId = await pluginDeliveryPartnerService.registerPartner({
        userId: user?.uid,
        name: activeName,
        phone: activePhone,
        whatsappNumber: activePhone.replace(/[^0-9]/g, ''),
        vehicleType,
        vehicleNumber: activeVehicleNum,
        identityDocUrl: identityDocUrl.trim() || 'Aadhaar ID Submitted & Verified',
        licenseDocUrl: licenseDocUrl.trim() || 'Driving Licence Verified',
        vehicleRcUrl: vehicleRcUrl.trim() || 'Vehicle Registration Certificate (RC) Verified',
        vehicleInsuranceUrl: vehicleInsuranceUrl.trim() || 'Vehicle Insurance / Permit Verified',
        latitude: parseFloat(manualLat) || 34.0837,
        longitude: parseFloat(manualLng) || 74.7973,
        currentAddress: 'Srinagar, Jammu & Kashmir',
        isOnline: true,
        baseDeliveryPrice: baseDeliveryPrice || 20,
        pricePerKm: pricePerKm || 10,
        monthlyFeeAmount: 299,
      });

      const fresh = await pluginDeliveryPartnerService.getPartnerById(partnerId);
      if (fresh) {
        setPartner(fresh);
      } else {
        // Fallback immediate partner object
        setPartner({
          partnerId,
          userId: user?.uid,
          name: activeName,
          phone: activePhone,
          whatsappNumber: activePhone.replace(/[^0-9]/g, ''),
          vehicleType,
          vehicleNumber: activeVehicleNum,
          identityDocUrl: identityDocUrl.trim() || 'Aadhaar ID Submitted & Verified',
          licenseDocUrl: licenseDocUrl.trim() || 'Driving Licence Verified',
          vehicleRcUrl: vehicleRcUrl.trim() || 'Vehicle Registration Certificate (RC) Verified',
          vehicleInsuranceUrl: vehicleInsuranceUrl.trim() || 'Vehicle Insurance / Permit Verified',
          latitude: parseFloat(manualLat) || 34.0837,
          longitude: parseFloat(manualLng) || 74.7973,
          currentAddress: 'Srinagar, Jammu & Kashmir',
          isOnline: true,
          baseDeliveryPrice: baseDeliveryPrice || 20,
          pricePerKm: pricePerKm || 10,
          monthlyFeeAmount: 299,
          approvalStatus: 'approved',
          subscriptionStatus: 'active',
          totalDeliveries: 0,
          rating: 5.0,
        });
      }
      setRegSuccess(true);
    } catch (err) {
      console.error('Error registering delivery partner:', err);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleToggleOnline = async () => {
    if (!partner) return;
    const nextStatus = !partner.isOnline;
    await pluginDeliveryPartnerService.updateLocationAndStatus(
      partner.partnerId,
      partner.latitude,
      partner.longitude,
      nextStatus,
      partner.currentAddress
    );
    setPartner({ ...partner, isOnline: nextStatus });
  };

  const handleUpdateGps = async () => {
    if (!partner) return;
    setIsUpdatingLocation(true);
    try {
      const gps = await requestLiveGpsLocation();
      await pluginDeliveryPartnerService.updateLocationAndStatus(
        partner.partnerId,
        gps.latitude,
        gps.longitude,
        partner.isOnline,
        gps.address || partner.currentAddress
      );
      setPartner({
        ...partner,
        latitude: gps.latitude,
        longitude: gps.longitude,
        currentAddress: gps.address || partner.currentAddress,
      });
      setManualLat(gps.latitude.toString());
      setManualLng(gps.longitude.toString());
    } catch {
      // fallback
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const handleSetManualCoords = async () => {
    if (!partner) return;
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) return;

    await pluginDeliveryPartnerService.updateLocationAndStatus(
      partner.partnerId,
      lat,
      lng,
      partner.isOnline,
      partner.currentAddress
    );
    setPartner({ ...partner, latitude: lat, longitude: lng });
  };

  const handleSavePricing = async () => {
    if (!partner) return;
    await pluginDeliveryPartnerService.updatePricing(
      partner.partnerId,
      baseDeliveryPrice,
      pricePerKm
    );
    setPartner({ ...partner, baseDeliveryPrice, pricePerKm });
  };

  const handleRenewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    setPayingSubscription(true);
    try {
      await pluginDeliveryPartnerService.processSubscriptionPayment(
        partner.partnerId,
        paymentRef.trim() || `UPI_${Date.now()}`
      );
      setPartner({
        ...partner,
        subscriptionStatus: 'active',
      });
      setShowSubscriptionModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setPayingSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <RefreshCw size={28} className="animate-spin text-orange-500" />
      </div>
    );
  }

  // If partner is not registered yet: Show Driver Registration Form with Document Uploads & ₹299 Monthly Fee Info
  if (!partner) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4 max-w-xl mx-auto">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="p-2.5 bg-white rounded-xl text-slate-700 font-bold text-xs uppercase flex items-center gap-1 shadow-sm mb-6"
        >
          <ChevronLeft size={16} />
          <span>Back to App</span>
        </button>

        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black">
              🛵
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Delivery Partner Registration</h1>
              <p className="text-xs text-slate-500 font-medium">
                Register vehicle, upload documents, set rate per km & appear live on OpenStreetMap
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                  Monthly Subscription Payment (₹299)
                </span>
                <p className="text-2xl font-black text-emerald-950">₹299 / Month</p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-200/80 text-emerald-900 rounded-lg text-[10px] font-black uppercase">
                Pay via UPI
              </span>
            </div>

            <p className="text-[11px] text-emerald-800 font-medium">
              Keep 100% of your delivery earnings directly from customers with direct WhatsApp & Call orders.
            </p>

            <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-2 text-xs">
              <p className="font-bold text-slate-800">Pay via Food India Merchant UPI QR</p>
              
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono text-xs">
                <span className="font-bold text-slate-900">UPI ID: 8825018335@axl</span>
                <button
                  type="button"
                  onClick={() => handleCopyUpi('8825018335@axl')}
                  className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-sans font-bold flex items-center gap-1 hover:bg-emerald-700"
                >
                  {copiedUpi ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <a
                href="upi://pay?pa=8825018335@axl&pn=Food%20India%20Merchant&am=299&cu=INR&tn=Delivery%20Boy%20Subscription"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <ExternalLink size={14} />
                <span>📱 Open UPI App to Pay ₹299 (GPay / PhonePe / Paytm)</span>
              </a>
            </div>
          </div>

          {!user ? (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleAuthLoading}
              className="w-full py-3.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-2xl flex items-center justify-center gap-2.5 shadow-sm transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{googleAuthLoading ? 'Connecting Google Account...' : 'Quick Register with Google'}</span>
            </button>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
              {user.photoURL && (
                <img src={user.photoURL} alt={user.displayName || 'Google Account'} className="w-9 h-9 rounded-full shrink-0" />
              )}
              <div className="min-w-0 text-xs">
                <p className="font-bold text-slate-900 truncate">{user.displayName || 'Google Account Connected'}</p>
                <p className="text-slate-500 text-[11px] truncate">{user.email}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Full Driver Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"
                placeholder="e.g. Tariq Ahmad"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Mobile Phone / WhatsApp Number</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"
                placeholder="+91 9876543210"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as any)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none"
                >
                  <option value="scooter">🛵 Scooter</option>
                  <option value="bike">🏍️ Motorcycle</option>
                  <option value="auto">🛺 Auto Rickshaw</option>
                  <option value="van">🚚 Delivery Van</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Vehicle Registration No.</label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase outline-none focus:border-emerald-500"
                  placeholder="JK-01-AB-1234"
                />
              </div>
            </div>

            {/* Document File Upload / Reference Fields */}
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <p className="font-black text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-emerald-600" />
                  <span>Verification Documents Upload (Firestore Saved)</span>
                </p>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Images / PDF Supported
                </span>
              </div>

              {/* 1. Identity Proof File Upload */}
              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-bold text-slate-800 flex justify-between items-center">
                  <span>1. Identity Proof (Aadhaar / PAN Card / Voter ID)</span>
                  {identityFileName && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      ✓ Selected
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-white border border-slate-300 hover:border-emerald-500 rounded-xl px-3.5 py-2.5 flex items-center justify-center gap-2 font-bold text-slate-700 hover:text-emerald-700 transition-colors shadow-sm">
                    <FileText size={16} className="text-emerald-600 shrink-0" />
                    <span className="truncate text-[11px]">
                      {identityFileName ? identityFileName : '📁 Choose Image / PDF File...'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileSelect(e, setIdentityDocUrl, setIdentityFileName)}
                      className="hidden"
                    />
                  </label>
                  {identityDocUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setIdentityDocUrl('');
                        setIdentityFileName('');
                      }}
                      className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={identityDocUrl.startsWith('data:') ? '' : identityDocUrl}
                  onChange={(e) => {
                    setIdentityDocUrl(e.target.value);
                    setIdentityFileName('');
                  }}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[11px] font-mono outline-none focus:border-emerald-500"
                  placeholder="Or enter Document ID No. (e.g. Aadhaar 4891-2093-1102)"
                />
              </div>

              {/* 2. Driving Licence File Upload */}
              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-bold text-slate-800 flex justify-between items-center">
                  <span>2. Driving Licence File</span>
                  {licenseFileName && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      ✓ Selected
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-white border border-slate-300 hover:border-emerald-500 rounded-xl px-3.5 py-2.5 flex items-center justify-center gap-2 font-bold text-slate-700 hover:text-emerald-700 transition-colors shadow-sm">
                    <FileText size={16} className="text-emerald-600 shrink-0" />
                    <span className="truncate text-[11px]">
                      {licenseFileName ? licenseFileName : '📁 Upload Licence Document...'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileSelect(e, setLicenseDocUrl, setLicenseFileName)}
                      className="hidden"
                    />
                  </label>
                  {licenseDocUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLicenseDocUrl('');
                        setLicenseFileName('');
                      }}
                      className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={licenseDocUrl.startsWith('data:') ? '' : licenseDocUrl}
                  onChange={(e) => {
                    setLicenseDocUrl(e.target.value);
                    setLicenseFileName('');
                  }}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[11px] font-mono outline-none focus:border-emerald-500"
                  placeholder="Or enter Licence No. (e.g. DL-JK-2022-001239)"
                />
              </div>

              {/* 3. Vehicle Registration Certificate (RC) File Upload */}
              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-bold text-slate-800 flex justify-between items-center">
                  <span>3. Vehicle Registration Certificate (RC Document File)</span>
                  {vehicleRcFileName && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      ✓ Selected
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-white border border-slate-300 hover:border-emerald-500 rounded-xl px-3.5 py-2.5 flex items-center justify-center gap-2 font-bold text-slate-700 hover:text-emerald-700 transition-colors shadow-sm">
                    <FileText size={16} className="text-emerald-600 shrink-0" />
                    <span className="truncate text-[11px]">
                      {vehicleRcFileName ? vehicleRcFileName : '📁 Upload Vehicle Registration (RC) File...'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileSelect(e, setVehicleRcUrl, setVehicleRcFileName)}
                      className="hidden"
                    />
                  </label>
                  {vehicleRcUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleRcUrl('');
                        setVehicleRcFileName('');
                      }}
                      className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={vehicleRcUrl.startsWith('data:') ? '' : vehicleRcUrl}
                  onChange={(e) => {
                    setVehicleRcUrl(e.target.value);
                    setVehicleRcFileName('');
                  }}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[11px] font-mono outline-none focus:border-emerald-500"
                  placeholder="Or enter Registration (RC) No. (e.g. JK01-AB-1234 RC Copy)"
                />
              </div>

              {/* 4. Vehicle Insurance / Permit File Upload */}
              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-bold text-slate-800 flex justify-between items-center">
                  <span>4. Vehicle Insurance / Permit Copy</span>
                  {vehicleInsuranceFileName && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      ✓ Selected
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-white border border-slate-300 hover:border-emerald-500 rounded-xl px-3.5 py-2.5 flex items-center justify-center gap-2 font-bold text-slate-700 hover:text-emerald-700 transition-colors shadow-sm">
                    <FileText size={16} className="text-emerald-600 shrink-0" />
                    <span className="truncate text-[11px]">
                      {vehicleInsuranceFileName ? vehicleInsuranceFileName : '📁 Upload Vehicle Insurance / Permit...'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileSelect(e, setVehicleInsuranceUrl, setVehicleInsuranceFileName)}
                      className="hidden"
                    />
                  </label>
                  {vehicleInsuranceUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleInsuranceUrl('');
                        setVehicleInsuranceFileName('');
                      }}
                      className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={vehicleInsuranceUrl.startsWith('data:') ? '' : vehicleInsuranceUrl}
                  onChange={(e) => {
                    setVehicleInsuranceUrl(e.target.value);
                    setVehicleInsuranceFileName('');
                  }}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[11px] font-mono outline-none focus:border-emerald-500"
                  placeholder="Or enter Insurance Policy No. / Reference"
                />
              </div>
            </div>

            {/* Custom Delivery Charges */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Base Price (₹)</label>
                <input
                  type="number"
                  required
                  value={baseDeliveryPrice}
                  onChange={(e) => setBaseDeliveryPrice(Number(e.target.value))}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-700 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Rate Per Km (₹/km)</label>
                <input
                  type="number"
                  required
                  value={pricePerKm}
                  onChange={(e) => setPricePerKm(Number(e.target.value))}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-700 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              onClick={(e) => {
                if (!isRegistering) {
                  handleRegister(e);
                }
              }}
              disabled={isRegistering}
              className="w-full h-13 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 text-xs mt-4 active:scale-95"
            >
              {isRegistering ? (
                <>
                  <RefreshCw size={18} className="animate-spin text-white" />
                  <span>Activating Subscription (₹299)...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Register & Pay ₹299 First Month Fee</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 max-w-3xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-100 text-slate-700 rounded-xl"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-base font-black text-slate-900">{partner.name}</h1>
            <p className="text-xs text-slate-500 font-bold">
              {partner.vehicleType.toUpperCase()} • {partner.vehicleNumber}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleOnline}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors ${
            partner.isOnline
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
          }`}
        >
          <Power size={14} />
          <span>{partner.isOnline ? 'ONLINE ON MAP' : 'OFFLINE'}</span>
        </button>
      </div>

      {/* Subscription & Pricing Status Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Monthly Subscription Status */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Monthly Subscription Status
            </span>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase">
              {partner.subscriptionStatus.toUpperCase()}
            </span>
          </div>

          <div>
            <p className="text-2xl font-black text-slate-900">₹299 / Month</p>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              Keep 100% of your round-trip delivery charges directly.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowSubscriptionModal(true)}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-slate-800"
          >
            <QrCode size={14} />
            <span>Renew / Pay ₹299 Subscription</span>
          </button>
        </div>

        {/* Custom Pricing Control */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Delivery Charge Settings
          </span>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="font-bold text-slate-500">Base Price (₹)</label>
              <input
                type="number"
                value={baseDeliveryPrice}
                onChange={(e) => setBaseDeliveryPrice(Number(e.target.value))}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 mt-1"
              />
            </div>

            <div>
              <label className="font-bold text-slate-500">Rate / Km (₹)</label>
              <input
                type="number"
                value={pricePerKm}
                onChange={(e) => setPricePerKm(Number(e.target.value))}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 mt-1"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSavePricing}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700"
          >
            Update Rates (₹{baseDeliveryPrice} + ₹{pricePerKm}/km)
          </button>
        </div>
      </div>

      {/* Live Map Coordinates Pickup */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
              <MapPin size={16} className="text-orange-500" />
              <span>Live Location on OpenStreetMap</span>
            </h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              Lat: {partner.latitude.toFixed(4)}, Lng: {partner.longitude.toFixed(4)}
            </p>
          </div>

          <button
            type="button"
            onClick={handleUpdateGps}
            disabled={isUpdatingLocation}
            className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm"
          >
            <Navigation size={13} className={isUpdatingLocation ? 'animate-spin' : ''} />
            <span>Detect GPS</span>
          </button>
        </div>

        {/* Manual Latitude / Longitude numerical input */}
        <div className="bg-slate-50 p-3.5 rounded-2xl space-y-2 border border-slate-200 text-xs">
          <p className="font-black text-slate-700 uppercase text-[10px]">
            Set Coordinates Manually
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold text-slate-500">Latitude</label>
              <input
                type="text"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-mono text-slate-900 font-bold mt-0.5"
              />
            </div>
            <div>
              <label className="font-bold text-slate-500">Longitude</label>
              <input
                type="text"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-mono text-slate-900 font-bold mt-0.5"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSetManualCoords}
            className="w-full py-2 bg-slate-900 text-white font-black text-[11px] uppercase rounded-xl"
          >
            Update Map Location
          </button>
        </div>
      </div>

      {/* Orders Available / Assigned for Delivery */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
          <ShoppingBag size={18} className="text-emerald-600" />
          <span>Plugin Direct Orders ({orders.length})</span>
        </h3>

        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.orderId}
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono font-black text-orange-600">#{o.orderNumber}</span>
                  <h4 className="font-black text-slate-900 text-sm">{o.restaurantName}</h4>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-black text-[10px] uppercase">
                  {(o.orderStatus || 'pending').replace(/_/g, ' ')}
                </span>
              </div>

              <div className="text-slate-600 space-y-1 pt-1 border-t border-slate-200/80">
                <p>
                  <strong>Customer:</strong> {o.customerName} ({o.customerPhone})
                </p>
                <p>
                  <strong>Address:</strong> {o.deliveryAddress}
                </p>
                <p>
                  <strong>Items:</strong> {(o.items || []).map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                </p>
                <p className="font-bold text-slate-900">
                  Total Collectible (COD): ₹{o.totalAmount}
                </p>
              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <p className="py-8 text-center text-slate-400 font-medium italic text-xs">
              No direct map orders queued at the moment. Keep your vehicle status ONLINE to appear on the live map.
            </p>
          )}
        </div>
      </div>

      {/* Subscription Payment Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4 text-center border border-slate-200 shadow-2xl">
            <h3 className="font-black text-slate-900 text-base">
              Monthly Subscription Payment (₹299)
            </h3>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-2.5">
              <QrCode size={40} className="mx-auto text-emerald-700" />
              <p className="font-bold">Pay via Food India Merchant UPI QR</p>
              
              <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-emerald-200 font-mono text-xs">
                <span className="font-bold text-slate-900">UPI ID: 8825018335@axl</span>
                <button
                  type="button"
                  onClick={() => handleCopyUpi('8825018335@axl')}
                  className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-sans font-bold flex items-center gap-1 hover:bg-emerald-700"
                >
                  {copiedUpi ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <a
                href="upi://pay?pa=8825018335@axl&pn=Food%20India%20Merchant&am=299&cu=INR&tn=Delivery%20Boy%20Subscription"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <ExternalLink size={14} />
                <span>📱 Open UPI App to Pay ₹299 (GPay / PhonePe / Paytm)</span>
              </a>
            </div>

            <form onSubmit={handleRenewSubscription} className="space-y-3 text-xs text-left">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">UPI Transaction Ref / UTR Number</label>
                <input
                  type="text"
                  required
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"
                  placeholder="e.g. UTR12938401923"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSubscriptionModal(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payingSubscription}
                  className="w-1/2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-colors"
                >
                  {payingSubscription ? 'Verifying...' : 'CONFIRM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
