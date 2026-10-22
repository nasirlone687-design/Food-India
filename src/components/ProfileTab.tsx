import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth';
import {
  User,
  MapPin,
  CreditCard,
  Shield,
  LogOut,
  ChevronRight,
  Settings,
  Calendar,
  Edit2,
  Plus,
  Trash2,
  Check,
  ExternalLink,
  Navigation,
  Loader2,
  Phone,
  FileText,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Address } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import {
  requestLiveGpsLocation,
  loadSavedLiveGpsLocation,
  getGoogleMapsCoordUrl,
} from '../utils/gps';

const ProfileTab: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newAddressLabel, setNewAddressLabel] = useState('Home');
  const [newAddressText, setNewAddressText] = useState('');
  const [newAddressPincode, setNewAddressPincode] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressDistrict, setNewAddressDistrict] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressCoords, setNewAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);

  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setPhone(profile.phone || '');
    }
    const savedGps = loadSavedLiveGpsLocation();
    if (savedGps && !newAddressCoords) {
      setNewAddressCoords({ lat: savedGps.latitude, lng: savedGps.longitude });
      if (savedGps.address) setNewAddressText(savedGps.address);
      if (savedGps.pincode) setNewAddressPincode(savedGps.pincode);
      if (savedGps.city) setNewAddressCity(savedGps.city);
      if (savedGps.district) setNewAddressDistrict(savedGps.district);
      if (savedGps.state) setNewAddressState(savedGps.state);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'addresses'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setAddresses(snap.docs.map((d) => ({ ...d.data(), addressId: d.id } as Address)));
    }, () => {});
    return () => {
      unsub();
    };
  }, [user]);

  const formatRegDate = (regDate: any) => {
    if (!regDate) return 'Active Member';
    try {
      if (regDate.toDate)
        return regDate.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      return new Date(regDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return 'Active Member';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !fullName.trim()) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: fullName.trim(),
        phone: phone.trim(),
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setIsEditingProfile(false);
      setStatusMsg('Profile saved successfully.');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePickupGpsForAddress = async () => {
    setLocatingGps(true);
    try {
      const gps = await requestLiveGpsLocation({
        uid: user?.uid,
        role: 'customer',
        phone: phone || profile?.phone,
      });
      setNewAddressCoords({ lat: gps.latitude, lng: gps.longitude });
      setNewAddressText(gps.address || `GPS (${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)})`);
      if (gps.pincode) setNewAddressPincode(gps.pincode);
      if (gps.city) setNewAddressCity(gps.city);
      if (gps.district) setNewAddressDistrict(gps.district);
      if (gps.state) setNewAddressState(gps.state);
      setStatusMsg(
        `Live GPS captured (${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)})${
          gps.pincode ? ` • PIN ${gps.pincode}` : ''
        }`
      );
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setStatusMsg(err?.message || 'Please allow Location access in your browser popup.');
      setTimeout(() => setStatusMsg(null), 4000);
    } finally {
      setLocatingGps(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAddressText.trim()) return;
    let coords = newAddressCoords;
    if (!coords) {
      try {
        const gps = await requestLiveGpsLocation({ uid: user.uid, role: 'customer' });
        coords = { lat: gps.latitude, lng: gps.longitude };
        if (gps.pincode && !newAddressPincode) setNewAddressPincode(gps.pincode);
        if (gps.city && !newAddressCity) setNewAddressCity(gps.city);
        if (gps.district && !newAddressDistrict) setNewAddressDistrict(gps.district);
        if (gps.state && !newAddressState) setNewAddressState(gps.state);
      } catch {
        setStatusMsg('Please allow browser GPS location to pin your exact delivery coordinates.');
        return;
      }
    }
    const addressId = uuidv4();
    const lat = coords.lat;
    const lng = coords.lng;
    await setDoc(doc(db, 'addresses', addressId), {
      addressId,
      uid: user.uid,
      label: newAddressLabel,
      recipientName: profile?.fullName || 'Customer',
      recipientPhone: profile?.phone || phone || '',
      fullAddress: newAddressText.trim(),
      pincode: newAddressPincode.trim(),
      postalCode: newAddressPincode.trim(),
      city: newAddressCity.trim(),
      district: newAddressDistrict.trim(),
      state: newAddressState.trim(),
      latitude: lat,
      longitude: lng,
      googleMapsLink: getGoogleMapsCoordUrl(lat, lng),
      isDefault: addresses.length === 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewAddressText('');
    setStatusMsg('Delivery address & live GPS coordinates saved to Firestore.');
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleDeleteAddress = async (id: string) => {
    await setDoc(
      doc(db, 'addresses', id),
      {
        uid: `archived_${user?.uid || 'user'}`,
        archived: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleDeleteCustomerAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    try {
      await authService.deleteAccount(user.uid, 'customer');
      navigate('/welcome');
    } catch (err: any) {
      setStatusMsg(err?.message || 'Failed to delete account.');
      setDeletingAccount(false);
    }
  };

  const menuItems = [
    { id: 'addresses', icon: <MapPin size={20} />, label: 'Saved Addresses & Live GPS', sub: `${addresses.length} saved delivery locations` },
    { id: 'about', icon: <Building2 size={20} />, label: 'About Food India & Legal Details', sub: 'A Unit of KulgamKart • FSSAI, GST & Udyam Details' },
    { id: 'payments', icon: <CreditCard size={20} />, label: 'Payments & COD Policy', sub: '100% Cash on Delivery for food orders' },
    { id: 'support', icon: <Phone size={20} />, label: 'Contact & Refund Support', sub: '+91 8825028335 • +91 8825018335' },
    { id: 'privacy', icon: <Shield size={20} />, label: 'Terms & Privacy Policy', sub: 'Legal terms, privacy & account deletion policy' },
    { id: 'settings', icon: <Settings size={20} />, label: 'Account Settings & Deletion', sub: 'Profile & account settings' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-full overflow-x-hidden">
      {statusMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold text-center">
          {statusMsg}
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center relative">
        <button
          onClick={() => setIsEditingProfile(!isEditingProfile)}
          className="absolute top-6 right-6 p-2.5 bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-xl transition-colors"
          title="Edit Profile"
        >
          <Edit2 size={16} />
        </button>

        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 overflow-hidden">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.fullName} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User size={36} />
            )}
          </div>
        </div>

        {isEditingProfile ? (
          <form onSubmit={handleSaveProfile} className="w-full max-w-xs space-y-3 mt-2">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-center focus:outline-none focus:border-orange-500"
              required
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone Number (+91)"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-center focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-2 justify-center">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2 bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-1"
              >
                <Check size={14} /> {savingProfile ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">{profile?.fullName}</h2>
            <p className="text-slate-400 font-medium text-xs sm:text-sm mb-1 break-all">{profile?.email}</p>
            {profile?.phone && <p className="text-slate-500 font-bold text-xs mb-2">{profile.phone}</p>}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
              <span className="text-orange-600 bg-orange-50 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-widest">
                {profile?.role || 'customer'}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                <Calendar size={11} /> Joined {formatRegDate(profile?.registrationDate || profile?.createdAt)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Menu List */}
      <div className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm">
        {menuItems.map((item, idx) => {
          const isOpen = activeSection === item.id;
          return (
            <div key={item.id} className={idx !== menuItems.length - 1 ? 'border-b border-slate-50' : ''}>
              <button
                onClick={() => setActiveSection(isOpen ? null : item.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">
                    {item.icon}
                  </div>
                  <div className="text-left min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{item.label}</h4>
                    <p className="text-xs text-slate-400 font-medium truncate">{item.sub}</p>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className={`text-slate-300 shrink-0 transition-transform ${isOpen ? 'rotate-90 text-orange-500' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-2 bg-slate-50/60 space-y-3">
                  {item.id === 'addresses' && (
                    <div className="space-y-3">
                      {addresses.map((addr) => {
                        const hasCoords = typeof addr.latitude === 'number' && typeof addr.longitude === 'number';
                        const mapsUrl = hasCoords
                          ? getGoogleMapsCoordUrl(addr.latitude, addr.longitude)
                          : addr.googleMapsLink;
                        return (
                          <div key={addr.addressId} className="bg-white p-3.5 rounded-2xl border border-slate-100 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                                  {addr.label}
                                </span>
                                <p className="text-xs font-medium text-slate-700 mt-1">{addr.fullAddress}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteAddress(addr.addressId)}
                                className="text-slate-400 hover:text-red-500 p-1"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            {hasCoords && (
                              <div className="pt-1.5 border-t border-slate-50 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[10px] font-mono font-bold text-slate-500">
                                  GPS: {addr.latitude.toFixed(6)}, {addr.longitude.toFixed(6)}
                                </span>
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                >
                                  <ExternalLink size={11} />
                                  <span>Open in Google Maps</span>
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <form onSubmit={handleAddAddress} className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex gap-1.5">
                            {['Home', 'Work', 'Other'].map((lbl) => (
                              <button
                                type="button"
                                key={lbl}
                                onClick={() => setNewAddressLabel(lbl)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                  newAddressLabel === lbl ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {lbl}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handlePickupGpsForAddress}
                            disabled={locatingGps}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1"
                          >
                            {locatingGps ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                            <span>{locatingGps ? 'Locating...' : 'Allow Browser GPS & Auto-Fill'}</span>
                          </button>
                        </div>

                        {newAddressCoords && (
                          <div className="p-2.5 bg-orange-50/70 border border-orange-100 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span className="font-mono font-bold text-slate-700">
                              GPS: {newAddressCoords.lat.toFixed(6)}, {newAddressCoords.lng.toFixed(6)}
                            </span>
                            <a
                              href={getGoogleMapsCoordUrl(newAddressCoords.lat, newAddressCoords.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 font-bold flex items-center gap-1 hover:underline"
                            >
                              <ExternalLink size={11} />
                              <span>Open in Google Maps</span>
                            </a>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newAddressPincode}
                            onChange={(e) => setNewAddressPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="PIN Code (Auto-filled)"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-orange-500"
                          />
                          <input
                            type="text"
                            value={newAddressCity}
                            onChange={(e) => setNewAddressCity(e.target.value)}
                            placeholder="City / Locality"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-orange-500"
                          />
                          <input
                            type="text"
                            value={newAddressDistrict}
                            onChange={(e) => setNewAddressDistrict(e.target.value)}
                            placeholder="District"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-orange-500"
                          />
                          <input
                            type="text"
                            value={newAddressState}
                            onChange={(e) => setNewAddressState(e.target.value)}
                            placeholder="State"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <input
                          type="text"
                          value={newAddressText}
                          onChange={(e) => setNewAddressText(e.target.value)}
                          placeholder="Complete street address / landmark..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-orange-500"
                          required
                        />
                        <button
                          type="submit"
                          className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1"
                        >
                          <Plus size={14} /> Save Address & GPS
                        </button>
                      </form>
                    </div>
                  )}

                  {item.id === 'about' && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-2.5 text-xs text-slate-700">
                      <p className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                        About Food India — Official Registration & Compliance Details
                      </p>
                      <p className="font-semibold text-slate-800">
                        <strong>Food India</strong> is an official unit of <strong>KulgamKart</strong>.
                      </p>
                      <div className="grid grid-cols-1 gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px]">
                        <p>
                          <span className="font-black text-slate-900">Parent Organization:</span> Food India (A Unit of KulgamKart)
                        </p>
                        <p>
                          <span className="font-black text-slate-900">Official Website:</span>{' '}
                          <a
                            href="https://kulgamkart.in"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 font-bold underline"
                          >
                            kulgamkart.in
                          </a>
                        </p>
                        <p>
                          <span className="font-black text-slate-900">Udyam Registration Number:</span>{' '}
                          <span className="font-mono font-bold text-slate-900">UDYAM-JK-11-0018721</span>
                        </p>
                        <p>
                          <span className="font-black text-slate-900">GST Number (GSTIN):</span>{' '}
                          <span className="font-mono font-bold text-slate-900">01BMAPL3192D1CY</span>
                        </p>
                        <p>
                          <span className="font-black text-slate-900">FSSAI अनुज्ञिप्त संख्या / License Number:</span>{' '}
                          <span className="font-mono font-bold text-emerald-700">11026999000072</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {item.id === 'payments' && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
                      <p className="font-bold text-slate-900">Cash on Delivery (COD) Exclusively</p>
                      <p>
                        All customer food orders on Food India are fulfilled via Cash on Delivery. Pay directly at your
                        doorstep upon receiving your order.
                      </p>
                    </div>
                  )}

                  {item.id === 'support' && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-2.5 text-xs">
                      <p className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                        24/7 Support, Help & Refund Contact
                      </p>
                      <a
                        href="tel:+918825028335"
                        className="flex items-center gap-2 font-bold text-orange-600 hover:underline"
                      >
                        <Phone size={14} />
                        <span>+91 8825028335 (Order & Dispatch Helpline)</span>
                      </a>
                      <a
                        href="tel:+918825018335"
                        className="flex items-center gap-2 font-bold text-emerald-700 hover:underline"
                      >
                        <Phone size={14} />
                        <span>+91 8825018335 / +8825018335</span>
                      </a>
                    </div>
                  )}

                  {item.id === 'privacy' && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                      <button
                        type="button"
                        onClick={() => navigate('/terms')}
                        className="w-full flex items-center justify-between font-bold text-orange-600 hover:underline py-1.5"
                      >
                        <span className="flex items-center gap-2">
                          <FileText size={14} /> Terms & Conditions
                        </span>
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/privacy')}
                        className="w-full flex items-center justify-between font-bold text-orange-600 hover:underline py-1.5"
                      >
                        <span className="flex items-center gap-2">
                          <Shield size={14} /> Privacy Policy
                        </span>
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/refund')}
                        className="w-full flex items-center justify-between font-bold text-orange-600 hover:underline py-1.5"
                      >
                        <span className="flex items-center gap-2">
                          <FileText size={14} /> Refund & Cancellation Policy
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}

                  {item.id === 'settings' && (
                    <div className="space-y-2.5">
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Edit Personal Details</span>
                        <button
                          onClick={() => setIsEditingProfile(true)}
                          className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg font-bold"
                        >
                          Edit Profile
                        </button>
                      </div>

                      <div className="bg-red-50/70 p-4 rounded-2xl border border-red-100 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-black text-red-700">Delete My Customer Account</p>
                            <p className="text-[11px] text-red-600/80">
                              Permanently remove your profile and saved addresses.
                            </p>
                          </div>
                          {!confirmDeleteAccount && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAccount(true)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-wider shrink-0"
                            >
                              Delete Account
                            </button>
                          )}
                        </div>
                        {confirmDeleteAccount && (
                          <div className="pt-2 border-t border-red-200/60 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-red-800 flex items-center gap-1">
                              <AlertTriangle size={13} /> Confirm permanent deletion?
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={deletingAccount}
                                onClick={handleDeleteCustomerAccount}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-black text-[10px] uppercase"
                              >
                                {deletingAccount ? 'Deleting...' : 'Yes, Delete'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteAccount(false)}
                                className="px-2.5 py-1.5 bg-white text-slate-600 rounded-lg font-bold text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Logout */}
      <button
        onClick={() => authService.logout()}
        className="w-full h-14 bg-red-50 text-red-600 rounded-[24px] font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-transform text-xs"
      >
        <LogOut size={18} />
        Log Out
      </button>
    </div>
  );
};

export default ProfileTab;
