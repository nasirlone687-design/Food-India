import React, { useState, useEffect } from 'react';
import {
  Navigation,
  MapPin,
  Phone,
  ExternalLink,
  CheckCircle2,
  Loader2,
  X,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  GpsCoordinates,
  requestLiveGpsLocation,
  pickupLiveGpsLocation,
  loadSavedLiveGpsLocation,
  getGoogleMapsCoordUrl,
  lookupLocationByPinOrCity,
  reverseGeocodeStructured,
  isLegacyFakeCoordinate,
  saveGpsLocationToFirestore,
  markSessionConfirmedGps,
} from '../utils/gps';
import {
  reportGlobalButtonStatus,
  reportGlobalError,
  copyToClipboardSafe,
} from '../context/ErrorLogContext';

interface GpsPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmed?: (result: {
    gps: GpsCoordinates;
    phone: string;
    address: string;
  }) => void;
  initialPhone?: string;
  title?: string;
  compulsory?: boolean;
}

export const GpsPermissionModal: React.FC<GpsPermissionModalProps> = ({
  isOpen,
  onClose,
  onConfirmed,
  initialPhone = '',
  title = 'Allow Phone GPS & Link Cell Number',
  compulsory = false,
}) => {
  const { user, profile, refreshProfile } = useAuth();
  const [gps, setGps] = useState<GpsCoordinates | null>(() => loadSavedLiveGpsLocation());
  const [phone, setPhone] = useState(initialPhone || profile?.phone || '');
  const [customAddress, setCustomAddress] = useState('');
  const [pinOrCityInput, setPinOrCityInput] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [lookingUpPin, setLookingUpPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSettingsGuide, setShowSettingsGuide] = useState(false);
  const [guidePlatform, setGuidePlatform] = useState<'android' | 'ios' | 'app'>('android');

  useEffect(() => {
    if (gps) {
      setManualLat(gps.latitude.toString());
      setManualLng(gps.longitude.toString());
    }
  }, [gps]);

  useEffect(() => {
    if (initialPhone || profile?.phone) {
      setPhone((prev) => prev || initialPhone || profile?.phone || '');
    }
    // Auto-detect device platform
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) {
        setGuidePlatform('ios');
      } else {
        setGuidePlatform('android');
      }
    }
  }, [initialPhone, profile?.phone]);

  useEffect(() => {
    if (!isOpen) return;
    const saved = loadSavedLiveGpsLocation();
    if (saved && !isLegacyFakeCoordinate(saved.latitude, saved.longitude)) {
      setGps(saved);
      if (!customAddress) setCustomAddress(saved.address);
      saveGpsLocationToFirestore(saved, {
        phone: phone || profile?.phone,
        uid: user?.uid,
        role: profile?.role,
      }).catch(() => {});
    } else if (
      profile?.liveGps &&
      !isLegacyFakeCoordinate(profile.liveGps.latitude, profile.liveGps.longitude)
    ) {
      const fromProfile: GpsCoordinates = {
        latitude: profile.liveGps.latitude,
        longitude: profile.liveGps.longitude,
        address: profile.liveGps.address,
        googleMapsUrl:
          profile.liveGps.googleMapsUrl ||
          getGoogleMapsCoordUrl(profile.liveGps.latitude, profile.liveGps.longitude),
        capturedAt: profile.liveGps.updatedAt || new Date().toISOString(),
        source: 'saved_cache',
      };
      setGps(fromProfile);
      if (!customAddress) setCustomAddress(fromProfile.address);
    } else {
      setGps(null);
      // Automatically request real phone GPS when the modal opens
      handleRequestLivePhoneGps();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestLivePhoneGps = async () => {
    setLocating(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      // Direct call to requestLiveGpsLocation which triggers native browser geolocation popup
      const coords = await requestLiveGpsLocation();
      setGps(coords);
      setCustomAddress(coords.address);
      await saveGpsLocationToFirestore(coords, {
        phone: phone.trim() || profile?.phone,
        uid: user?.uid,
        role: profile?.role,
      });
      markSessionConfirmedGps();
      setShowSettingsGuide(false);
      setStatusMessage(
        `Real Phone GPS captured & saved to Firestore (${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)})!`
      );
      reportGlobalButtonStatus({
        buttonName: 'Allow Phone GPS & Capture Live Coordinates',
        backendPath: 'Firestore: deviceLocations & users',
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Live GPS locked & saved in Firestore at ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (${coords.address}).`,
      });
    } catch (err: any) {
      setShowSettingsGuide(true);
      setErrorMessage(
        err?.message ||
          'Your device/browser blocked location access. Follow the guide below to enable Location in your device settings or enter your 6-digit PIN code.'
      );
    } finally {
      setLocating(false);
    }
  };

  const handleLookupPinCode = async () => {
    if (!pinOrCityInput.trim()) return;
    setLookingUpPin(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await lookupLocationByPinOrCity(pinOrCityInput.trim());
      const resolvedGps: GpsCoordinates = {
        latitude: Number(res.latitude.toFixed(6)),
        longitude: Number(res.longitude.toFixed(6)),
        address: res.formattedAddress,
        city: res.city,
        district: res.district,
        state: res.state,
        pincode: res.pincode,
        googleMapsUrl: res.googleMapsUrl,
        capturedAt: new Date().toISOString(),
        source: 'device_gps',
      };
      try {
        localStorage.setItem('food_india_live_gps', JSON.stringify(resolvedGps));
      } catch {
        // ignore
      }
      await saveGpsLocationToFirestore(resolvedGps, {
        phone: phone.trim() || profile?.phone,
        uid: user?.uid,
        role: profile?.role,
      });
      markSessionConfirmedGps();
      setGps(resolvedGps);
      setCustomAddress(res.formattedAddress);
      setStatusMessage(
        `Coordinates pinned & saved to Firestore (${resolvedGps.latitude.toFixed(6)}, ${resolvedGps.longitude.toFixed(6)})!`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not find coordinates for that PIN or city.');
    } finally {
      setLookingUpPin(false);
    }
  };

  const handleApplyManualCoordinates = async () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setErrorMessage('Please enter a valid Latitude (-90 to 90).');
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setErrorMessage('Please enter a valid Longitude (-180 to 180).');
      return;
    }
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const geo = await reverseGeocodeStructured(lat, lng);
      const resolvedGps: GpsCoordinates = {
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        address: geo.address || customAddress || `Coordinates (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
        city: geo.city,
        district: geo.district,
        state: geo.state,
        pincode: geo.pincode,
        googleMapsUrl: getGoogleMapsCoordUrl(lat, lng),
        capturedAt: new Date().toISOString(),
        source: 'device_gps',
      };
      try {
        localStorage.setItem('food_india_live_gps', JSON.stringify(resolvedGps));
      } catch {
        // ignore
      }
      await saveGpsLocationToFirestore(resolvedGps, {
        phone: phone.trim() || profile?.phone,
        uid: user?.uid,
        role: profile?.role,
      });
      markSessionConfirmedGps();
      setGps(resolvedGps);
      if (!customAddress) setCustomAddress(resolvedGps.address);
      setStatusMessage(
        `Manual coordinates locked & saved (${resolvedGps.latitude.toFixed(6)}, ${resolvedGps.longitude.toFixed(6)})!`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to apply manual coordinates.');
    }
  };

  const handleSaveToProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      let activeGps = gps;
      if (!activeGps) {
        activeGps = await pickupLiveGpsLocation();
        setGps(activeGps);
      }

      const cleanPhone = phone.trim() || profile?.phone || '';
      const finalAddress = customAddress.trim() || activeGps.address;
      const googleMapsUrl = getGoogleMapsCoordUrl(activeGps.latitude, activeGps.longitude);

      const finalGps: GpsCoordinates = {
        ...activeGps,
        address: finalAddress,
        googleMapsUrl,
      };

      try {
        localStorage.setItem('food_india_live_gps', JSON.stringify(finalGps));
      } catch {
        // ignore
      }

      // Always save to Firestore deviceLocations + user profile
      await saveGpsLocationToFirestore(finalGps, {
        phone: cleanPhone,
        uid: user?.uid,
        role: profile?.role,
      });
      markSessionConfirmedGps();

      if (user) {
        const liveGpsPayload = {
          latitude: finalGps.latitude,
          longitude: finalGps.longitude,
          address: finalAddress,
          googleMapsUrl,
          updatedAt: new Date().toISOString(),
        };

        await setDoc(
          doc(db, 'users', user.uid),
          {
            uid: user.uid,
            ...(cleanPhone ? { phone: cleanPhone } : {}),
            liveGps: liveGpsPayload,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (profile?.role === 'seller') {
          const restId = `rest_${user.uid}`;
          await setDoc(
            doc(db, 'sellers', user.uid),
            {
              uid: user.uid,
              sellerId: user.uid,
              ...(cleanPhone ? { phone: cleanPhone, businessPhone: cleanPhone } : {}),
              latitude: finalGps.latitude,
              longitude: finalGps.longitude,
              googleMapsLink: googleMapsUrl,
              ...(finalGps.state ? { state: finalGps.state } : {}),
              ...(finalGps.city ? { city: finalGps.city } : {}),
              ...(finalGps.district ? { district: finalGps.district } : {}),
              ...(finalGps.pincode ? { pincode: finalGps.pincode } : {}),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          await setDoc(
            doc(db, 'restaurants', restId),
            {
              restaurantId: restId,
              sellerId: user.uid,
              ...(cleanPhone ? { phone: cleanPhone } : {}),
              address: finalAddress,
              latitude: finalGps.latitude,
              longitude: finalGps.longitude,
              googleMapsLink: googleMapsUrl,
              ...(finalGps.state ? { state: finalGps.state } : {}),
              ...(finalGps.city ? { city: finalGps.city, locality: finalGps.city } : {}),
              ...(finalGps.district ? { district: finalGps.district } : {}),
              ...(finalGps.pincode ? { pincode: finalGps.pincode, postalCode: finalGps.pincode } : {}),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          await setDoc(
            doc(db, 'customers', user.uid),
            {
              uid: user.uid,
              ...(cleanPhone ? { phone: cleanPhone } : {}),
              liveGps: liveGpsPayload,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        await refreshProfile().catch(() => {});
      }

      reportGlobalButtonStatus({
        buttonName: 'Save Live GPS & Phone to Firestore',
        backendPath: `Firestore: deviceLocations & ${
          user
            ? profile?.role === 'seller'
              ? `sellers/${user.uid}`
              : `customers/${user.uid}`
            : 'guest device profile'
        }`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Saved GPS (${finalGps.latitude.toFixed(6)}, ${finalGps.longitude.toFixed(
          6
        )}) & Phone (${cleanPhone || 'linked'}) to Firestore.`,
      });

      onConfirmed?.({
        gps: finalGps,
        phone: cleanPhone,
        address: finalAddress,
      });

      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          'Please tap "Allow Phone GPS" or enter your 6-digit PIN code first so we can capture your coordinates.'
      );
      reportGlobalError(
        err?.message || 'Failed to save GPS & phone to Firestore',
        err?.stack,
        'gps',
        {
          buttonName: 'Save Live GPS & Phone to Firestore',
          backendPath: `Firestore: deviceLocations & users/${user?.uid || 'guest'}`,
          dbUpdated: 'NOT_UPDATED',
          statusType: 'error',
        }
      );
    } finally {
      setSaving(false);
    }
  };

  const canDismiss = true; // Location pickup is never compulsory

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-md max-h-[90vh] rounded-[28px] shadow-2xl border border-slate-100 flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Sticky Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <Navigation size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-100 block">
                {compulsory ? 'Compulsory Location Access (Saved in Firestore)' : 'Real Device Hardware GPS'}
              </span>
              <h3 className="text-base sm:text-lg font-black leading-tight truncate">{title}</h3>
            </div>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Scrollable Body - min-h-0 is mandatory for flex-1 overflow scrolling */}
        <form
          onSubmit={handleSaveToProfile}
          className="p-4 sm:p-5 space-y-4 overflow-y-auto min-h-0 flex-1 overscroll-contain"
        >
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            Allow your phone&apos;s hardware GPS to pin your exact live delivery coordinates on Google Maps and permanently save your live location in Firestore for accurate nearby dishes and order delivery.
          </p>

          {/* Primary Action: Request Browser/Phone Geolocation Permission */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleRequestLivePhoneGps}
              disabled={locating}
              className="w-full py-3.5 px-4 bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all disabled:opacity-60"
            >
              {locating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Requesting Device GPS Sensor...</span>
                </>
              ) : (
                <>
                  <Navigation size={16} />
                  <span>Allow Location Access &amp; Save Live GPS</span>
                </>
              )}
            </button>

            {/* Link to show Device / Browser Settings Instructions */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setShowSettingsGuide((prev) => !prev)}
                className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1"
              >
                <span>📱 {showSettingsGuide ? 'Hide' : 'How to'} Open Device Location Access</span>
              </button>
              <span className="text-[10px] font-semibold text-slate-400">Android • iPhone • PWA</span>
            </div>
          </div>

          {/* Device Location Settings Interactive Guide Card */}
          {showSettingsGuide && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2.5 text-xs animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                <span className="font-black text-amber-900 uppercase text-[10px] tracking-wider">
                  How to Enable Location on Device
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setGuidePlatform('android')}
                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      guidePlatform === 'android' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Android
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuidePlatform('ios')}
                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      guidePlatform === 'ios' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    iPhone (iOS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuidePlatform('app')}
                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      guidePlatform === 'app' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    App / PWA
                  </button>
                </div>
              </div>

              {guidePlatform === 'android' && (
                <ol className="list-decimal list-inside space-y-1 text-slate-700 font-medium text-[11px]">
                  <li>
                    Tap the <strong>Lock (🔒)</strong> or <strong>Tune (⚙️)</strong> icon in your browser URL bar.
                  </li>
                  <li>
                    Tap <strong>Permissions</strong> → <strong>Location</strong> → Switch to <strong>&ldquo;Allow&rdquo;</strong>.
                  </li>
                  <li>
                    Refresh the page and tap <em>Allow Location Access</em> above.
                  </li>
                </ol>
              )}

              {guidePlatform === 'ios' && (
                <ol className="list-decimal list-inside space-y-1 text-slate-700 font-medium text-[11px]">
                  <li>
                    Tap the <strong>&ldquo;aA&rdquo;</strong> or settings icon on the left of the Safari address bar.
                  </li>
                  <li>
                    Tap <strong>Website Settings</strong> → <strong>Location</strong> → Choose <strong>&ldquo;Allow&rdquo;</strong>.
                  </li>
                  <li>
                    Alternatively go to <em>iPhone Settings → Safari → Location → Allow</em>.
                  </li>
                </ol>
              )}

              {guidePlatform === 'app' && (
                <ol className="list-decimal list-inside space-y-1 text-slate-700 font-medium text-[11px]">
                  <li>Open phone <strong>Settings</strong> → <strong>Apps &amp; Notifications</strong>.</li>
                  <li>Select <strong>Food India</strong> (or your browser) → <strong>Permissions</strong>.</li>
                  <li>Tap <strong>Location</strong> and set to <strong>&ldquo;Allow all the time&rdquo;</strong>.</li>
                </ol>
              )}

              <button
                type="button"
                onClick={handleRequestLivePhoneGps}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm mt-1"
              >
                <Navigation size={12} />
                <span>Retry Device GPS Prompt Now</span>
              </button>
            </div>
          )}

          {/* PIN Code / City Exact Lookup */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
              Or Pin Exact Location by 6-Digit PIN Code / City
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pinOrCityInput}
                onChange={(e) => setPinOrCityInput(e.target.value)}
                placeholder="e.g. 190001, Srinagar, Jammu..."
                className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={handleLookupPinCode}
                disabled={lookingUpPin || !pinOrCityInput.trim()}
                className="px-3 h-10 bg-slate-900 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0"
              >
                {lookingUpPin ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>Pin GPS</span>
              </button>
            </div>
          </div>

          {/* Manual Latitude & Longitude Coordinates Input Section */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={12} className="text-orange-500" />
              <span>Or Enter GPS Coordinates Manually (Latitude &amp; Longitude)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Latitude</span>
                <input
                  type="number"
                  step="any"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="e.g. 34.0837"
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">Longitude</span>
                <input
                  type="number"
                  step="any"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  placeholder="e.g. 74.7973"
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleApplyManualCoordinates}
              disabled={!manualLat.trim() || !manualLng.trim()}
              className="w-full py-2 bg-slate-900 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles size={12} />
              <span>Set Manual Coordinates</span>
            </button>
          </div>

          {/* Live Coordinates & Direct Google Maps Pin Box */}
          {gps && (
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 size={14} />
                  <span>Live Coordinates Saved in Firestore</span>
                </div>
                <a
                  href={getGoogleMapsCoordUrl(gps.latitude, gps.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                >
                  <ExternalLink size={11} />
                  <span>Open in Google Maps</span>
                </a>
              </div>

              <div className="flex items-center justify-between bg-slate-800/90 px-3 py-2 rounded-xl border border-slate-700 font-mono text-xs">
                <span className="text-orange-300 font-bold">
                  Lat: {gps.latitude.toFixed(6)}, Lng: {gps.longitude.toFixed(6)}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await copyToClipboardSafe(
                      `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`
                    );
                    setCopiedCoords(true);
                    setTimeout(() => setCopiedCoords(false), 2000);
                  }}
                  className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[10px] font-sans font-bold flex items-center gap-1"
                >
                  {copiedCoords ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedCoords ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Cell Phone Number Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Phone size={12} className="text-orange-500" />
              <span>Cell Phone Number (For Delivery &amp; SMS Updates)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              required={Boolean(user)}
              className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
            />
          </div>

          {/* Complete Street Address Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={12} className="text-orange-500" />
              <span>Complete Delivery Address / Landmark</span>
            </label>
            <textarea
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              placeholder="House/Flat No., Building, Street, Area, City..."
              rows={2}
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
            />
          </div>

          {statusMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
              {errorMessage}
            </div>
          )}

          {/* Sticky Bottom Actions */}
          <div className="flex gap-2.5 pt-2 sticky bottom-0 bg-white pb-1">
            {canDismiss && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                Close
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-[2] py-3 bg-slate-900 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-lg disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving to Firestore...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Confirm &amp; Save Location to Firestore</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
