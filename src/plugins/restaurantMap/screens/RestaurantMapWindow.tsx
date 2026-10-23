import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PluginRestaurant, PluginMapSettings, PluginOrder, PluginDeliveryPartner } from '../models/types';
import { pluginSettingsService } from '../services/pluginSettingsService';
import { pluginRestaurantService } from '../services/pluginRestaurantService';
import { pluginOrderService } from '../services/pluginOrderService';
import { pluginDeliveryPartnerService } from '../services/pluginDeliveryPartnerService';
import { LeafletMapContainer } from '../components/LeafletMapContainer';
import { HalfScreenMenuPanel } from '../components/HalfScreenMenuPanel';
import { JoinRestaurantModal } from '../components/JoinRestaurantModal';
import { DeliveryPartnerModal } from '../components/DeliveryPartnerModal';
import { useAuth } from '../../../context/AuthContext';
import { requestLiveGpsLocation, loadSavedLiveGpsLocation } from '../../../utils/gps';
import {
  Search,
  MapPin,
  Navigation,
  Store,
  ChevronLeft,
  Filter,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  X,
  Plus,
  Truck,
} from 'lucide-react';

export const RestaurantMapWindow: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [settings, setSettings] = useState<PluginMapSettings | null>(null);
  const [restaurants, setRestaurants] = useState<PluginRestaurant[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<PluginDeliveryPartner[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<PluginRestaurant | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PluginDeliveryPartner | null>(null);
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [showOrdersModal, setShowOrdersModal] = useState<boolean>(false);
  const [myOrders, setMyOrders] = useState<PluginOrder[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState<string>('all');
  const [openOnly, setOpenOnly] = useState<boolean>(false);

  // User location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() => {
    const saved = loadSavedLiveGpsLocation();
    if (saved) return { lat: saved.latitude, lng: saved.longitude };
    return null;
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Subscribe to plugin settings
  useEffect(() => {
    const unsub = pluginSettingsService.subscribeSettings((s) => {
      setSettings(s);
    });
    return () => unsub();
  }, []);

  // Subscribe to approved map restaurants
  useEffect(() => {
    const unsub = pluginRestaurantService.subscribeApprovedRestaurants((list) => {
      setRestaurants(list);
    });
    return () => unsub();
  }, []);

  // Subscribe to live delivery partners with vehicle symbols
  useEffect(() => {
    const unsub = pluginDeliveryPartnerService.subscribeLivePartners((list) => {
      setDeliveryPartners(list);
    });
    return () => unsub();
  }, []);

  // Subscribe to customer orders
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = pluginOrderService.subscribeCustomerOrders(user.uid, (orders) => {
      setMyOrders(orders);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleLocateMe = async () => {
    setIsLocating(true);
    try {
      const gps = await requestLiveGpsLocation();
      setUserLocation({ lat: gps.latitude, lng: gps.longitude });
    } catch {
      // fallback
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    if (!userLocation) {
      handleLocateMe();
    }
  }, []);

  // Filter restaurants
  const cuisines = Array.from(
    new Set(restaurants.flatMap((r) => r.cuisineTypes || ['Indian Cuisine']))
  );

  const filteredRestaurants = restaurants.filter((r) => {
    if (openOnly && !r.isOpen) return false;
    if (selectedCuisine !== 'all' && !(r.cuisineTypes || []).includes(selectedCuisine)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchAddress = r.address.toLowerCase().includes(q);
      const matchCuisine = (r.cuisineTypes || []).some((c) => c.toLowerCase().includes(q));
      return matchName || matchAddress || matchCuisine;
    }
    return true;
  });

  // If plugin is turned OFF by admin
  if (settings && !settings.isEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-slate-200 text-slate-500 rounded-3xl flex items-center justify-center mb-4">
          <Store size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900">Restaurant Map Plugin is Currently Disabled</h2>
        <p className="text-xs text-slate-500 max-w-sm mt-2 font-medium">
          The administrator has turned off the Restaurant Map window. All plugin data is preserved.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 px-6 py-3 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg hover:bg-orange-600"
        >
          Return to Main App
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-100 flex flex-col">
      {/* Top Floating Control Header */}
      <header className="absolute top-0 left-0 right-0 z-20 p-3 sm:p-4 max-w-2xl mx-auto w-full pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2.5 shadow-xl border border-slate-200 pointer-events-auto space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors shrink-0"
              title="Back"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">
                  Restaurant Map
                </h1>
                <p className="text-[10px] font-bold text-slate-400 truncate">
                  {filteredRestaurants.length} Kitchens • {deliveryPartners.length} Live Drivers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/delivery-partner-dashboard')}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 shadow-sm"
                title="Delivery Partner Registration & Live Dashboard"
              >
                <Truck size={12} />
                <span className="hidden sm:inline">Join Driver</span>
              </button>

              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 shadow-sm"
              >
                <Plus size={12} />
                <span>Join Kitchen</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search restaurant name, cuisine, address..."
              className="w-full h-10 pl-9 pr-4 bg-slate-50 rounded-xl text-xs font-medium border border-slate-200 outline-none focus:border-orange-500"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          </div>

          {/* Cuisine Chips */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <button
              type="button"
              onClick={() => setSelectedCuisine('all')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                selectedCuisine === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Cuisines
            </button>
            {cuisines.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setSelectedCuisine(c)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                  selectedCuisine === c
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpenOnly(!openOnly)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap border ${
                openOnly
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              {openOnly ? 'Open Only ✓' : 'Filter Open'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Interactive Map View (Leaflet OpenStreetMap with Live Vehicles) */}
      <main className="flex-1 w-full h-full relative z-0">
        <LeafletMapContainer
          restaurants={filteredRestaurants}
          selectedRestaurant={selectedRestaurant}
          onSelectRestaurant={(r) => setSelectedRestaurant(r)}
          deliveryPartners={deliveryPartners}
          selectedPartner={selectedPartner}
          onSelectPartner={(p) => setSelectedPartner(p)}
          userLocation={userLocation}
          onRequestLocation={handleLocateMe}
          isLocating={isLocating}
        />
      </main>

      {/* Half-screen menu panel overlay when restaurant is selected */}
      {selectedRestaurant && (
        <HalfScreenMenuPanel
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
          userLocation={userLocation}
          availablePartners={deliveryPartners}
        />
      )}

      {/* Delivery Partner Detail Modal overlay when vehicle marker is tapped */}
      {selectedPartner && (
        <DeliveryPartnerModal
          partner={selectedPartner}
          onClose={() => setSelectedPartner(null)}
          selectedRestaurant={selectedRestaurant}
          userLocation={userLocation}
        />
      )}

      {/* Join Restaurant Modal */}
      <JoinRestaurantModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onRegistered={(id) => {
          setShowJoinModal(false);
          navigate(`/plugin-seller-dashboard`);
        }}
      />

      {/* Plugin Customer Orders Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">Your Restaurant Map Orders</h3>
              <button
                type="button"
                onClick={() => setShowOrdersModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {myOrders.map((o) => (
                <div key={o.orderId} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono font-black text-orange-600">#{o.orderNumber}</p>
                      <p className="font-bold text-slate-900 text-sm">{o.restaurantName}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-black uppercase text-[10px]">
                      {(o.orderStatus || 'pending').replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-slate-600">
                    {(o.items || []).map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </p>

                  <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-slate-900">
                    <span>Total Bill (COD)</span>
                    <span>₹{o.totalAmount}</span>
                  </div>
                </div>
              ))}

              {myOrders.length === 0 && (
                <p className="text-center py-8 text-slate-400 font-medium italic text-xs">
                  No direct map orders placed yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
