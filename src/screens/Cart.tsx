import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  MapPin,
  CreditCard,
  ChevronRight,
  ShoppingBag,
  AlertCircle,
  Loader2,
  Truck,
  CheckCircle2,
  Info,
  Navigation,
  ExternalLink,
  Phone,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { restaurantService } from '../services/restaurants';
import { mapsService } from '../services/maps';
import { orderService } from '../services/orders';
import { deliveryService } from '../services/delivery';
import { Restaurant, DeliveryQuote } from '../models/types';
import { LocationPicker } from '../components/LocationPicker';
import { GpsPermissionModal } from '../components/GpsPermissionModal';
import { getGoogleMapsCoordUrl, loadSavedLiveGpsLocation, pickupLiveGpsLocation } from '../utils/gps';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { reportGlobalButtonStatus } from '../context/ErrorLogContext';

const CartScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    items: rawItems,
    restaurantId,
    restaurantName,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
  } = useCart();
  const items = Array.isArray(rawItems) ? rawItems : [];
  const { user, profile } = useAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [sellerGstEnabled, setSellerGstEnabled] = useState<boolean>(false);
  const [deliveryLocation, setDeliveryLocation] = useState<{
    address: string;
    latitude: number;
    longitude: number;
    googleMapsLink: string;
    state?: string;
    city?: string;
    district?: string;
    pincode?: string;
  } | null>(() => {
    const saved = loadSavedLiveGpsLocation();
    if (saved) {
      return {
        address: saved.address || `Live Phone GPS (${saved.latitude.toFixed(6)}, ${saved.longitude.toFixed(6)})`,
        latitude: saved.latitude,
        longitude: saved.longitude,
        googleMapsLink: saved.googleMapsUrl,
        state: saved.state,
        city: saved.city,
        district: saved.district,
        pincode: saved.pincode,
      };
    }
    return null;
  });

  const [customerPhone, setCustomerPhone] = useState(profile?.phone || '+91 9876543210');
  const [showGpsModal, setShowGpsModal] = useState(false);

  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(25);

  // Modular Delivery Options Discovery State
  const [eligibleQuotes, setEligibleQuotes] = useState<DeliveryQuote[]>([]);
  const [ineligibleQuotes, setIneligibleQuotes] = useState<DeliveryQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<DeliveryQuote | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  const [loading, setLoading] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const isGstAllowedForSeller = Boolean(restaurant?.gstEnabled || sellerGstEnabled);
  const gstAmount = isGstAllowedForSeller ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
  const finalTotalToPay = Math.round((subtotal + deliveryCharge + gstAmount) * 100) / 100;

  useEffect(() => {
    if (profile?.phone) {
      setCustomerPhone(profile.phone);
    }
    if (profile?.liveGps && !deliveryLocation) {
      setDeliveryLocation({
        address:
          profile.liveGps.address ||
          `Live Phone GPS (${profile.liveGps.latitude.toFixed(6)}, ${profile.liveGps.longitude.toFixed(6)})`,
        latitude: profile.liveGps.latitude,
        longitude: profile.liveGps.longitude,
        googleMapsLink:
          profile.liveGps.googleMapsUrl ||
          getGoogleMapsCoordUrl(profile.liveGps.latitude, profile.liveGps.longitude),
      });
    }
  }, [profile]);

  // Continuously sync with background GPS tracker while on Cart screen
  useEffect(() => {
    if (!deliveryLocation) {
      pickupLiveGpsLocation(true)
        .then((gps) => {
          setDeliveryLocation({
            address: gps.address || `Live Phone GPS (${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)})`,
            latitude: gps.latitude,
            longitude: gps.longitude,
            googleMapsLink: gps.googleMapsUrl,
            state: gps.state,
            city: gps.city,
            district: gps.district,
            pincode: gps.pincode,
          });
        })
        .catch(() => {});
    }

    const handleGpsEvent = (e: Event) => {
      const gps = (e as CustomEvent).detail;
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        setDeliveryLocation({
          address: gps.address || `Live Phone GPS (${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)})`,
          latitude: gps.latitude,
          longitude: gps.longitude,
          googleMapsLink: gps.googleMapsUrl,
          state: gps.state,
          city: gps.city,
          district: gps.district,
          pincode: gps.pincode,
        });
      }
    };
    window.addEventListener('food_india_gps_updated', handleGpsEvent);
    return () => window.removeEventListener('food_india_gps_updated', handleGpsEvent);
  }, []);

  // Fetch restaurant & seller details for delivery and 5% GST calculation
  useEffect(() => {
    if (!restaurantId) return;
    const fetchRestaurant = async () => {
      setLoading(true);
      try {
        const data = await restaurantService.getRestaurant(restaurantId);
        setRestaurant(data);
        if (data?.gstEnabled) {
          setSellerGstEnabled(true);
        } else if (data?.sellerId) {
          const { getDoc } = await import('firebase/firestore');
          const sellerSnap = await getDoc(doc(db, 'sellers', data.sellerId)).catch(() => null);
          if (sellerSnap && sellerSnap.exists() && sellerSnap.data()?.gstEnabled) {
            setSellerGstEnabled(true);
          } else {
            setSellerGstEnabled(false);
          }
        }
      } catch (err) {
        console.error('Error fetching restaurant for cart:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurant();
  }, [restaurantId]);

  // Compute route and discover available delivery methods when location or restaurant changes
  useEffect(() => {
    if (!restaurant || !deliveryLocation) return;

    const calculateDeliveryAndQuotes = async () => {
      setError(null);
      setLoadingQuotes(true);
      try {
        const route = await mapsService.computeRoute(
          { lat: restaurant.latitude || deliveryLocation.latitude, lng: restaurant.longitude || deliveryLocation.longitude },
          { lat: deliveryLocation.latitude, lng: deliveryLocation.longitude }
        );

        let distKm = 1.5;
        let fallbackCharge = restaurant.baseDeliveryCharge || 25;

        if (route) {
          setDistanceMeters(route.distanceMeters);
          distKm = Number((route.distanceMeters / 1000).toFixed(2));
          const pricingMode =
            restaurant.deliveryPricingMode === 'base_plus_per_km'
              ? 'base_km'
              : (restaurant.deliveryPricingMode as 'base_km' | 'range') || 'base_km';
          const perKm = restaurant.deliveryPricePerKm ?? restaurant.perKmDeliveryCharge ?? 5;
          fallbackCharge = mapsService.calculateDeliveryCharge(
            route.distanceMeters,
            pricingMode,
            restaurant.baseDeliveryCharge || 20,
            perKm,
            restaurant.deliveryRanges || []
          );
        }

        // Discover eligible third-party, local delivery company API, and restaurant own-staff delivery quotes
        const discovery = await deliveryService.discoverQuotes({
          restaurantId: restaurant.restaurantId,
          pickupLat: restaurant.latitude || deliveryLocation.latitude,
          pickupLng: restaurant.longitude || deliveryLocation.longitude,
          pickupAddress: restaurant.address,
          pickupState: restaurant.state,
          pickupCity: restaurant.city || restaurant.locality,
          pickupDistrict: restaurant.district,
          pickupPincode: restaurant.pincode || restaurant.postalCode,
          dropLat: deliveryLocation.latitude,
          dropLng: deliveryLocation.longitude,
          dropAddress: deliveryLocation.address,
          dropState: deliveryLocation.state,
          dropCity: deliveryLocation.city,
          dropDistrict: deliveryLocation.district,
          dropPincode: deliveryLocation.pincode,
          distanceKm: distKm,
        });

        setEligibleQuotes(discovery.eligibleQuotes || []);
        setIneligibleQuotes(discovery.ineligibleQuotes || []);

        if (discovery.eligibleQuotes && discovery.eligibleQuotes.length > 0) {
          const chosen = discovery.eligibleQuotes[0];
          setSelectedQuote(chosen);
          setDeliveryCharge(chosen.estimatedFee);
        } else {
          setSelectedQuote(null);
          setDeliveryCharge(fallbackCharge);
        }
      } catch (err) {
        console.error('Error computing delivery quotes:', err);
        setDeliveryCharge(restaurant.baseDeliveryCharge || 25);
      } finally {
        setLoadingQuotes(false);
      }
    };

    calculateDeliveryAndQuotes();
  }, [restaurant, deliveryLocation]);

  const handleSelectQuote = (quote: DeliveryQuote) => {
    setSelectedQuote(quote);
    setDeliveryCharge(quote.estimatedFee);
  };

  const handleSavePhoneToProfile = async (newPhone: string) => {
    const trimmed = newPhone.trim();
    if (!user || !trimmed) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { phone: trimmed, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await setDoc(
        doc(db, 'customers', user.uid),
        { uid: user.uid, phone: trimmed, updatedAt: serverTimestamp() },
        { merge: true }
      );
      reportGlobalButtonStatus({
        buttonName: 'Save Customer Cell Number',
        backendPath: `Firestore: users/${user.uid} & customers/${user.uid}`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Customer cell phone "${trimmed}" permanently linked to profile.`,
      });
    } catch {
      // ignore
    }
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;

    setPlacingOrder(true);
    setError(null);
    try {
      // Guarantee active delivery location from live/background GPS
      let activeLoc = deliveryLocation;
      if (!activeLoc) {
        try {
          const gps = loadSavedLiveGpsLocation() || (await pickupLiveGpsLocation(true));
          activeLoc = {
            address: gps.address || `Live Phone GPS (${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)})`,
            latitude: gps.latitude,
            longitude: gps.longitude,
            googleMapsLink: gps.googleMapsUrl,
            state: gps.state || 'India',
            city: gps.city || 'India',
            district: gps.district || '',
            pincode: gps.pincode || '',
          };
          setDeliveryLocation(activeLoc);
        } catch {
          setShowLocationPicker(true);
          throw new Error('Compulsory: Please select or place your exact delivery location pin on the map before placing your order.');
        }
      }

      const rawPhone = customerPhone.trim() || profile?.phone?.trim() || '+91 9876543210';
      const cleanPhone = rawPhone.replace(/\D/g, '').length >= 10 ? rawPhone : '+91 9876543210';
      const resolvedRestaurantId = restaurantId || restaurant?.restaurantId || '';
      const resolvedSellerId = restaurant?.sellerId || '';

      const mapsLink =
        activeLoc.googleMapsLink ||
        getGoogleMapsCoordUrl(activeLoc.latitude, activeLoc.longitude);

      const orderItems = items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: Number(i.price || i.basePrice || 0),
        quantity: Number(i.quantity || 1),
        image: i.image || '',
      }));

      const orderId = await orderService.createOrder({
        customerId: user?.uid || 'guest_customer',
        customerName: profile?.fullName || user?.displayName || 'Verified Customer',
        customerPhone: cleanPhone,
        customerEmail: profile?.email || user?.email || '',
        sellerId: resolvedSellerId,
        restaurantId: resolvedRestaurantId,
        restaurantName: restaurantName || restaurant?.restaurantName || 'Food India Royal Darbar',
        restaurantPhone: restaurant?.phone || '+91 8825018335',
        items: orderItems,
        itemsSnapshot: items,
        itemSubtotal: subtotal,
        gstEnabled: isGstAllowedForSeller,
        gstRate: isGstAllowedForSeller ? 5 : 0,
        gstAmount,
        deliveryCharge: Number(deliveryCharge || 25),
        totalAmount: finalTotalToPay,
        paymentMethod: 'COD',
        customerLatitude: activeLoc.latitude,
        customerLongitude: activeLoc.longitude,
        restaurantLatitude: restaurant?.latitude || activeLoc.latitude,
        restaurantLongitude: restaurant?.longitude || activeLoc.longitude,
        distanceKm: distanceMeters ? Number((distanceMeters / 1000).toFixed(2)) : 1.5,
        selectedDeliveryProviderId: selectedQuote?.providerId || 'local_delivery_company',
        selectedDeliveryProviderCode: selectedQuote?.providerCode || 'local_delivery_company',
        selectedDeliveryProviderName:
          selectedQuote?.providerName || 'Local Express Food Delivery Co.',
        selectedDeliveryProviderType: selectedQuote?.providerType || 'third_party_api',
        selectedDeliveryQuoteId: selectedQuote?.quoteId || '',
        deliveryEstimatedEtaMin: selectedQuote?.estimatedDurationMin || 28,
        deliveryBookingStatus: 'booked',
        deliveryAddress: activeLoc.address,
        addressSnapshot: {
          displayName: activeLoc.address.split(',')[0] || 'Delivery Location',
          formattedAddress: activeLoc.address,
          latitude: activeLoc.latitude,
          longitude: activeLoc.longitude,
          googleMapsLink: mapsLink,
          state: activeLoc.state || 'India',
          city: activeLoc.city || 'India',
          district: activeLoc.district || '',
          pincode: activeLoc.pincode || '',
        },
      } as any);

      await clearCart();
      navigate(`/order-success/${orderId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-12 h-12 text-orange-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Your cart is empty</h2>
        <p className="text-gray-500 mt-2 max-w-xs">
          Looks like you haven&apos;t added anything to your cart yet.
        </p>
        <button
          onClick={() => navigate('/customer')}
          className="mt-8 px-8 py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-600 transition-colors"
        >
          Browse Restaurants
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* On-Screen Phone GPS Permission & Contact Details Modal */}
      <GpsPermissionModal
        isOpen={showGpsModal}
        onClose={() => setShowGpsModal(false)}
        initialPhone={customerPhone}
        onConfirmed={({ gps, phone, address }) => {
          setCustomerPhone(phone);
          setDeliveryLocation({
            address,
            latitude: gps.latitude,
            longitude: gps.longitude,
            googleMapsLink: gps.googleMapsUrl,
            state: gps.state,
            city: gps.city,
            district: gps.district,
            pincode: gps.pincode,
          });
          setError(null);
        }}
      />

      {/* Header */}
      <header className="bg-white px-4 py-4 flex items-center justify-between sticky top-0 z-10 border-b">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Your Cart</h1>
            <p className="text-xs text-gray-500">{restaurantName}</p>
          </div>
        </div>
        <button
          onClick={clearCart}
          className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Items List */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          {items.map((item) => (
            <div key={item.cartItemId} className="flex gap-4 py-2 border-b last:border-0">
              <img
                src={item.image || 'https://picsum.photos/seed/food/100/100'}
                alt={item.name}
                className="w-16 h-16 rounded-xl object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
                {item.variant && (
                  <p className="text-xs text-gray-500">Variant: {item.variant.name}</p>
                )}
                {(item.selectedAddOns || []).length > 0 && (
                  <p className="text-xs text-gray-500 truncate">
                    Add-ons: {(item.selectedAddOns || []).map((a) => a.option?.name).join(', ')}
                  </p>
                )}
                <p className="text-orange-600 font-bold text-sm mt-1">₹{item.lineTotal}</p>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 h-fit px-2 py-1 rounded-lg border">
                <button
                  onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                  className="p-1 hover:text-orange-500 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                  className="p-1 hover:text-orange-500 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Customer Contact Cell Number & Live GPS Popup Trigger */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3 border border-orange-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-orange-500" />
              Customer Cell Number & Live Phone GPS
            </h3>
            <button
              type="button"
              onClick={() => setShowGpsModal(true)}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Allow Phone GPS Popup</span>
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Cell Number (Sent to Seller Dashboard & WhatsApp)
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              onBlur={() => handleSavePhoneToProfile(customerPhone)}
              placeholder="Enter 10-digit mobile number (e.g. +91 9876543210)"
              className="w-full h-11 px-3.5 bg-slate-50 rounded-xl text-sm font-bold border border-slate-200 focus:border-orange-500 outline-none"
            />
          </div>
        </div>

        {/* Delivery Location */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              Delivery Location
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGpsModal(true)}
                className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100"
              >
                Use Phone GPS
              </button>
              <button
                type="button"
                onClick={() => setShowLocationPicker(!showLocationPicker)}
                className="text-sm font-bold text-orange-500 hover:text-orange-600"
              >
                {deliveryLocation ? 'Change on Map' : 'Select on Map'}
              </button>
            </div>
          </div>

          {/* Manual Placement Helper Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
            <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">Device location not accessible or need exact drop-off spot?</p>
              <p className="text-[11px] text-amber-800">
                Tap <strong>&quot;{deliveryLocation ? 'Change on Map' : 'Select on Map'}&quot;</strong> above, then <strong>move the arrow / red pin</strong> or tap the map to pick your exact delivery doorstep.
              </p>
            </div>
          </div>

          {deliveryLocation ? (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
              <p className="text-sm font-medium text-gray-900">{deliveryLocation.address}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-bold text-slate-600">
                  GPS: {deliveryLocation.latitude.toFixed(6)},{' '}
                  {deliveryLocation.longitude.toFixed(6)}
                </span>
                <a
                  href={getGoogleMapsCoordUrl(
                    deliveryLocation.latitude,
                    deliveryLocation.longitude
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open in Google Maps</span>
                </a>
              </div>
              {distanceMeters !== null && (
                <p className="text-xs text-gray-500">
                  Distance from restaurant: {(distanceMeters / 1000).toFixed(1)} km
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => setShowGpsModal(true)}
                className="w-full py-4 border-2 border-dashed border-orange-200 bg-orange-50/30 rounded-xl text-orange-600 text-sm font-bold hover:border-orange-500 transition-colors flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                Tap to Allow Phone&apos;s Live GPS Location
              </button>
              <button
                type="button"
                onClick={() => setShowLocationPicker(true)}
                className="w-full py-3 bg-slate-900 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Or Pick Exact Location on Map by Moving Pin
              </button>
            </div>
          )}

          {showLocationPicker && (
            <div className="pt-4 border-t space-y-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                <p className="font-bold flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                  Pick Exact Delivery Location
                </p>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Move the red pin or tap directly on the map to set your exact doorstep.
                </p>
              </div>
              <LocationPicker
                onLocationSelect={(loc) => {
                  setDeliveryLocation(loc);
                  setShowLocationPicker(false);
                }}
                initialLocation={
                  deliveryLocation
                    ? { lat: deliveryLocation.latitude, lng: deliveryLocation.longitude }
                    : undefined
                }
                initialAddress={deliveryLocation?.address}
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Delivery Service Selection */}
        {deliveryLocation && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-orange-500" />
                  Choose Delivery Service
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Filtered by restaurant city, state, PIN code, and GPS radius
                </p>
              </div>
              {loadingQuotes && <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />}
            </div>

            <div className="space-y-3">
              {eligibleQuotes.map((quote) => {
                const isSelected = selectedQuote?.providerId === quote.providerId;
                return (
                  <div
                    key={quote.providerId}
                    onClick={() => handleSelectQuote(quote)}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/40'
                        : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                            isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-gray-900 text-sm">
                              {quote.providerName}
                            </span>
                            {quote.isTestMockProvider && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                Test / Sandbox Demo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">
                            ETA: ~{quote.estimatedDurationMin} mins • {quote.coverageMatchDetails}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">{quote.conditionsNote}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-orange-600">
                          ₹{quote.estimatedFee}
                        </span>
                        <span className="block text-[10px] font-bold text-gray-400 uppercase">
                          Est. Fee
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-2.5 pt-2.5 border-t border-orange-200/60 flex items-start gap-1.5 text-[11px] text-orange-900">
                        <Info className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                        <span>{quote.priceChangeExplanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {ineligibleQuotes.length > 0 && (
                <details className="text-xs text-gray-400 pt-1">
                  <summary className="cursor-pointer font-semibold hover:text-gray-600">
                    Unavailable / Unconfigured Delivery Partners ({ineligibleQuotes.length})
                  </summary>
                  <div className="mt-2 space-y-2 pl-2 border-l-2 border-gray-100">
                    {ineligibleQuotes.map((iq) => (
                      <div key={iq.providerId} className="text-[11px] text-gray-500">
                        <span className="font-bold text-gray-700">{iq.providerName}:</span>{' '}
                        {iq.ineligibilityReason}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Payment Method */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-500" />
            Payment Method
          </h3>
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="text-sm font-bold text-gray-900">Cash on Delivery (COD)</span>
            </div>
            <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded uppercase">
              Only Option
            </span>
          </div>
          <p className="text-[10px] text-gray-400">
            Online payment is currently unavailable for food orders. Please pay cash upon delivery.
          </p>
        </div>

        {/* Bill Details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-900">Bill Details</h3>
            {isGstAllowedForSeller && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                GST Registered Seller (5% GST)
              </span>
            )}
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Item Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {isGstAllowedForSeller && (
            <div className="flex justify-between text-sm text-emerald-700 font-semibold bg-emerald-50/60 px-2.5 py-1.5 rounded-lg border border-emerald-100">
              <span>GST (5% Govt. Tax - Admin Approved Seller)</span>
              <span>₹{gstAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>
              Delivery Fee {selectedQuote ? `(${selectedQuote.providerName})` : ''}
            </span>
            <span>{deliveryLocation ? `₹${deliveryCharge.toFixed(2)}` : 'Select location'}</span>
          </div>
          <div className="border-t pt-2 mt-2 flex justify-between font-bold text-gray-900 text-lg">
            <span>To Pay (COD)</span>
            <span>₹{finalTotalToPay.toFixed(2)}</span>
          </div>
        </div>

        {/* Legal & Policy Links */}
        <div className="py-4 text-center space-y-1.5 pb-24 text-[11px] text-slate-400">
          <p>Official Website: <a href="https://foodindia.sbs" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline font-bold">foodindia.sbs</a> • A unit of KulgamKart (kulgamkart.in)</p>
          <div className="flex items-center justify-center gap-3 font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => navigate('/terms')}
              className="hover:text-orange-600 underline"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => navigate('/privacy')}
              className="hover:text-orange-600 underline"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => navigate('/refund')}
              className="hover:text-orange-600 underline"
            >
              Refund Policy
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-20">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handlePlaceOrder}
            disabled={placingOrder || Boolean(error && error.includes('too far'))}
            className="w-full py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-200 hover:bg-orange-600 disabled:bg-gray-300 disabled:shadow-none transition-all flex items-center justify-between px-6"
          >
            <div className="text-left">
              <p className="text-xs opacity-80">
                TOTAL TO PAY (COD{isGstAllowedForSeller ? ' • INCL. 5% GST' : ''})
              </p>
              <p className="text-lg font-black">₹{finalTotalToPay.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span>{placingOrder ? 'Placing Order...' : 'Place COD Order'}</span>
              {placingOrder ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartScreen;
