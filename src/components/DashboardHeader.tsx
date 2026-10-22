import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  ShoppingCart,
  User,
  MapPin,
  ChevronDown,
  Navigation,
  ExternalLink,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Logo } from './Logo';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { GpsCoordinates, requestLiveGpsLocation, loadSavedLiveGpsLocation } from '../utils/gps';
import { NotificationCenterModal } from './NotificationCenterModal';
import { GpsPermissionModal } from './GpsPermissionModal';
import { normalizeIndianWhatsAppNumber } from '../services/notifications';
import { getSavedCustomerOrderIds, getOrCreateCustomerDeviceId, getSavedCustomerPhone } from '../utils/orderStorage';
import { copyToClipboardSafe } from '../context/ErrorLogContext';

interface DashboardHeaderProps {
  address?: string;
  onAddressClick?: () => void;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  onCartClick?: () => void;
  onProfileClick?: () => void;
}

import { useNavigate } from 'react-router-dom';
import { pluginSettingsService } from '../plugins/restaurantMap/services/pluginSettingsService';

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  address = 'Allow Phone GPS Location',
  onAddressClick,
  onSearchClick,
  onCartClick,
  onProfileClick,
}) => {
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { user, profile } = useAuth();
  const [liveGps, setLiveGps] = useState<GpsCoordinates | null>(() => loadSavedLiveGpsLocation());
  const [locatingGps, setLocatingGps] = useState(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pluginEnabled, setPluginEnabled] = useState(false);

  useEffect(() => {
    const unsubPlugin = pluginSettingsService.subscribeSettings((cfg) => {
      setPluginEnabled(cfg?.isEnabled || false);
    });
    return () => unsubPlugin();
  }, []);

  useEffect(() => {
    const devCustId = getOrCreateCustomerDeviceId();
    const savedPhone = getSavedCustomerPhone();
    const targetPhone = profile?.phone || savedPhone || '';
    const cleanPhoneDigits = normalizeIndianWhatsAppNumber(targetPhone);

    const unsub = onSnapshot(
      collection(db, 'notifications'),
      (snap) => {
        const savedOrderIds = new Set(getSavedCustomerOrderIds());
        const allList = snap.docs.map(
          (d) => ({ notificationId: d.id, ...d.data() } as any)
        );

        const unread = allList.filter((n) => {
          if (n.readAt) return false;
          if (n.orderId && savedOrderIds.has(n.orderId)) return true;
          if (user?.uid && n.recipientUid === user.uid) return true;
          if (n.recipientUid === devCustId) return true;
          if (cleanPhoneDigits && n.recipientPhone) {
            const notifPhoneDigits = normalizeIndianWhatsAppNumber(n.recipientPhone);
            if (notifPhoneDigits && (notifPhoneDigits === cleanPhoneDigits || notifPhoneDigits.endsWith(cleanPhoneDigits.slice(-10)))) {
              return true;
            }
          }
          if (user?.email && n.recipientEmail && n.recipientEmail.toLowerCase() === user.email.toLowerCase()) {
            return true;
          }
          return false;
        }).length;

        setUnreadCount(unread);
      },
      () => {}
    );
    return () => unsub();
  }, [user?.uid, user?.email, profile?.phone]);

  const handlePickupLiveGps = async () => {
    setLocatingGps(true);
    setGpsErrorMsg(null);
    try {
      const coords = await requestLiveGpsLocation({
        uid: user?.uid,
        role: (profile?.role as any) || 'customer',
        phone: profile?.phone,
      });
      setLiveGps(coords);
      if (onAddressClick) {
        onAddressClick();
      }
    } catch (err: any) {
      setGpsErrorMsg(err?.message || 'Please allow Location access in your browser popup.');
      setShowGpsModal(true);
    } finally {
      setLocatingGps(false);
    }
  };

  useEffect(() => {
    const saved = loadSavedLiveGpsLocation();
    if (saved) setLiveGps(saved);

    const handleGpsEvent = (e: Event) => {
      const custom = e as CustomEvent<GpsCoordinates>;
      if (custom.detail && Number.isFinite(custom.detail.latitude)) {
        setLiveGps(custom.detail);
        setGpsErrorMsg(null);
      }
    };
    window.addEventListener('food_india_gps_updated', handleGpsEvent);
    return () => window.removeEventListener('food_india_gps_updated', handleGpsEvent);
  }, []);

  const displayAddress =
    liveGps?.address ||
    (liveGps?.city && liveGps?.pincode
      ? `${liveGps.locality ? `${liveGps.locality}, ` : ''}${liveGps.city} - ${liveGps.pincode}`
      : '') ||
    profile?.liveGps?.address ||
    address;

  return (
    <>
      <NotificationCenterModal isOpen={showNotifModal} onClose={() => setShowNotifModal(false)} />
      <GpsPermissionModal
        isOpen={showGpsModal}
        onClose={() => setShowGpsModal(false)}
        initialPhone={profile?.phone || getSavedCustomerPhone()}
        onConfirmed={({ gps: confirmedGps }) => {
          setLiveGps(confirmedGps);
          setShowGpsModal(false);
        }}
      />

      <header className="bg-white px-4 pt-4 pb-3 sticky top-0 z-50 border-b border-slate-100 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <Logo className="w-8 h-8 shrink-0" />
            <button
              type="button"
              onClick={() => setShowGpsModal(true)}
              className="flex flex-col items-start overflow-hidden text-left group"
              title="Tap to trigger Browser Live GPS Location Popup"
            >
              <div className="flex items-center gap-1 text-[10px] font-black text-orange-600 uppercase tracking-widest">
                <MapPin size={10} strokeWidth={3} />
                <span>
                  Deliver to {liveGps?.pincode ? `(PIN: ${liveGps.pincode})` : '(Tap for Live GPS)'}
                </span>
                <ChevronDown
                  size={10}
                  strokeWidth={3}
                  className="group-hover:translate-y-0.5 transition-transform"
                />
              </div>
              <span className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                {locatingGps ? 'Detecting Live Phone GPS...' : displayAddress}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {pluginEnabled && (
              <button
                type="button"
                onClick={() => navigate('/restaurant-map')}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-md transition-all shrink-0"
                title="Open Restaurant Map & Direct Ordering Window"
              >
                <MapPin size={13} />
                <span className="hidden sm:inline">Restaurant Map</span>
              </button>
            )}
            <button
              onClick={() => setShowNotifModal(true)}
              className="w-10 h-10 flex items-center justify-center text-slate-600 relative hover:bg-slate-50 rounded-full transition-colors"
              title="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white px-1">
                  {unreadCount}
                </span>
              ) : (
                <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-white" />
              )}
            </button>
            <button
              onClick={onCartClick}
              className="w-10 h-10 flex items-center justify-center text-slate-600 relative hover:bg-slate-50 rounded-full transition-colors"
            >
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white px-1">
                  {itemCount}
                </span>
              )}
            </button>
            <button
              onClick={onProfileClick}
              className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
            >
              <User size={20} />
            </button>
          </div>
        </div>

        {/* Live GPS Location Pickup & Google Maps Coordinate Link Bar */}
        <div className="bg-orange-50/80 border border-orange-100 rounded-2xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handlePickupLiveGps}
              disabled={locatingGps}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-sm transition-colors disabled:opacity-60"
            >
              {locatingGps ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
              <span>{locatingGps ? 'Locating GPS...' : 'Allow Phone GPS'}</span>
            </button>

            {liveGps ? (
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-700 truncate">
                <span>
                  {liveGps.latitude.toFixed(6)}, {liveGps.longitude.toFixed(6)}
                  {liveGps.pincode ? ` • PIN ${liveGps.pincode}` : ''}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await copyToClipboardSafe(
                      `${liveGps.latitude.toFixed(6)}, ${liveGps.longitude.toFixed(6)}`
                    );
                    setCopiedCoords(true);
                    setTimeout(() => setCopiedCoords(false), 2000);
                  }}
                  className="p-1 bg-white rounded border border-orange-200 text-orange-700 hover:bg-orange-100 shrink-0"
                  title="Copy GPS Coordinates"
                >
                  {copiedCoords ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePickupLiveGps}
                className="text-[11px] text-orange-700 font-bold hover:underline truncate"
              >
                {gpsErrorMsg || 'Tap to allow Browser GPS popup & auto-fill PIN code'}
              </button>
            )}
          </div>

          {liveGps && (
            <a
              href={liveGps.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 shadow-sm"
            >
              <ExternalLink size={11} />
              <span>Open in Google Maps</span>
            </a>
          )}
        </div>

        <div className="relative group">
          <button
            onClick={onSearchClick}
            className="w-full h-11 bg-slate-100 rounded-2xl flex items-center px-4 gap-3 text-slate-400 group-hover:bg-slate-200 transition-colors border border-transparent focus-within:border-orange-500 focus-within:bg-white"
          >
            <Search size={18} className="text-slate-400" />
            <span className="text-sm font-medium">Search for &quot;Biryani&quot;, &quot;Pizza&quot;...</span>
          </button>
        </div>
      </header>
    </>
  );
};
