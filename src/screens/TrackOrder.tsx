import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Clock,
  CheckCircle2,
  Package,
  Bike,
  Navigation,
  Loader2,
  XCircle,
  ShoppingBag,
  Truck,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Bug
} from 'lucide-react';
import { Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { doc, onSnapshot, getDoc, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Order, Restaurant, DeliveryBooking, DeliveryStatusHistoryItem, DeliveryQuote } from '../models/types';
import { orderService } from '../services/orders';
import { deliveryService } from '../services/delivery';
import { useAuth } from '../context/AuthContext';
import { getGoogleMapsCoordUrl } from '../utils/gps';
import { useErrorLog, copyToClipboardSafe, reportGlobalError } from '../context/ErrorLogContext';

const TrackOrderScreen: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [booking, setBooking] = useState<DeliveryBooking | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryStatusHistoryItem[]>([]);
  const [eligibleQuotes, setEligibleQuotes] = useState<DeliveryQuote[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
  const [copiedError, setCopiedError] = useState(false);
  const { setIsOpen: setErrorWindowOpen } = useErrorLog();

  const map = useMap();
  const coreLib = useMapsLibrary('core');

  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = onSnapshot(doc(db, 'orders', orderId), (snapshot) => {
      if (snapshot.exists()) {
        const orderData = { ...snapshot.data(), orderId: snapshot.id } as Order;
        setOrder(orderData);
        if (orderData.selectedDeliveryProviderId && !selectedProviderId) {
          setSelectedProviderId(orderData.selectedDeliveryProviderId);
        }
        
        if (!restaurant) {
          getDoc(doc(db, 'restaurants', orderData.restaurantId)).then(resSnap => {
            if (resSnap.exists()) {
              setRestaurant({ ...resSnap.data(), restaurantId: resSnap.id } as Restaurant);
            }
          }).catch(() => {});
        }
      }
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    const qBookings = query(collection(db, 'deliveryBookings'), where('orderId', '==', orderId));
    const unsubBookings = onSnapshot(qBookings, (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), bookingId: d.id } as DeliveryBooking));
      all.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      const active = all.find(b => !['cancelled', 'failed'].includes(b.bookingStatus)) || all[0] || null;
      setBooking(active);
    }, () => {});

    const qHist = query(collection(db, 'deliveryStatusHistory'), where('orderId', '==', orderId));
    const unsubHist = onSnapshot(qHist, (snap) => {
      const items = snap.docs.map(d => ({ ...d.data(), historyId: d.id } as DeliveryStatusHistoryItem));
      items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setDeliveryHistory(items);
    }, () => {});

    return () => {
      unsubscribe();
      unsubBookings();
      unsubHist();
    };
  }, [orderId, restaurant]);

  // Discover eligible delivery options for selection / fallback reassignment
  useEffect(() => {
    if (!order || !restaurant) return;
    deliveryService.discoverQuotes({
      restaurantId: restaurant.restaurantId,
      pickupLat: restaurant.latitude,
      pickupLng: restaurant.longitude,
      pickupAddress: restaurant.address,
      dropLat: order.addressSnapshot?.latitude || 28.6139,
      dropLng: order.addressSnapshot?.longitude || 77.209,
      dropAddress: order.addressSnapshot?.formattedAddress || '',
      distanceKm: order.distanceKm,
    }).then(res => {
      setEligibleQuotes(res.eligibleQuotes);
      if (!selectedProviderId && res.eligibleQuotes.length > 0) {
        setSelectedProviderId(order.selectedDeliveryProviderId || res.eligibleQuotes[0].providerId);
      }
    }).catch(() => {});
  }, [order?.orderId, restaurant?.restaurantId]);

  useEffect(() => {
    if (map && order && restaurant && coreLib && order.addressSnapshot?.latitude && order.addressSnapshot?.longitude) {
      const bounds = new coreLib.LatLngBounds();
      bounds.extend({ lat: restaurant.latitude, lng: restaurant.longitude });
      bounds.extend({ 
        lat: order.addressSnapshot.latitude, 
        lng: order.addressSnapshot.longitude 
      });
      map.fitBounds(bounds, { top: 80, bottom: 80, left: 80, right: 80 });
    }
  }, [map, order, restaurant, coreLib]);

  const handleCancelOrder = async () => {
    if (!order || order.orderStatus !== 'pending') return;
    setCancelling(true);
    try {
      await orderService.updateOrderStatus(order.orderId, 'cancelled', 'Cancelled by customer before confirmation');
    } catch (err) {
      console.error('Failed to cancel order:', err);
    } finally {
      setCancelling(false);
    }
  };

  const handleBookDelivery = async (simulateFailure = false) => {
    if (!order) return;
    setBookingLoading(true);
    setDeliveryError(null);
    setDeliveryNotice(null);
    try {
      const res = await deliveryService.bookDelivery({
        orderId: order.orderId,
        providerId: selectedProviderId || order.selectedDeliveryProviderId,
        confirmedByRole: 'customer',
        simulateFailure,
      });
      if (res.idempotentReplay) {
        setDeliveryNotice('Active delivery booking already exists. Duplicate booking & extra charge prevented.');
      } else {
        setDeliveryNotice(`Delivery booked with ${res.booking.providerName} (Tracking: ${res.booking.trackingRef}).`);
      }
    } catch (err: any) {
      const msg = err.message || 'Delivery booking failed. Please choose another available delivery method.';
      setDeliveryError(msg);
      reportGlobalError(msg, err?.stack, 'app');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelOrReassignDelivery = async (newProvId?: string) => {
    if (!order) return;
    setBookingLoading(true);
    setDeliveryError(null);
    try {
      await deliveryService.cancelOrReassignBooking({
        orderId: order.orderId,
        bookingId: booking?.bookingId,
        newProviderId: newProvId,
        reason: newProvId ? 'Customer switched delivery provider' : 'Cancelled by customer',
        actorRole: 'customer',
      });
      if (newProvId) {
        setSelectedProviderId(newProvId);
        setDeliveryNotice('Previous booking cancelled without extra charge. Click "Confirm & Book Delivery" to dispatch the new provider.');
      } else {
        setDeliveryNotice('Delivery booking cancelled. You can select another delivery method below.');
      }
    } catch (err: any) {
      setDeliveryError(err.message || 'Failed to cancel/reassign delivery');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleSandboxWebhook = async (targetStatus: 'rider_assigned' | 'picked_up' | 'in_transit' | 'delivered') => {
    if (!booking || !order) return;
    setWebhookLoading(targetStatus);
    setDeliveryError(null);
    try {
      await deliveryService.triggerSandboxWebhook({
        bookingId: booking.bookingId,
        orderId: order.orderId,
        targetStatus,
      });
      setDeliveryNotice(`Verified HMAC-SHA256 webhook processed: ${targetStatus.replace(/_/g, ' ').toUpperCase()}`);
    } catch (err: any) {
      setDeliveryError(err.message || 'Webhook simulation failed');
    } finally {
      setWebhookLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h2>
        <button onClick={() => navigate('/orders')} className="text-orange-500 font-semibold">
          Back to Orders
        </button>
      </div>
    );
  }

  const steps = [
    { status: 'pending', icon: Clock, label: 'Placed' },
    { status: 'confirmed', icon: CheckCircle2, label: 'Accepted' },
    { status: 'preparing', icon: Package, label: 'Preparing' },
    { status: 'ready_for_pickup', icon: ShoppingBag, label: 'Ready' },
    { status: 'out_for_delivery', icon: Bike, label: 'On the Way' },
    { status: 'delivered', icon: CheckCircle2, label: 'Delivered' },
  ];

  const currentStepIndex = Math.max(0, steps.findIndex(s => s.status === order.orderStatus));
  const isOrderAccepted = ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(order.orderStatus);
  const hasActiveBooking = Boolean(booking && !['cancelled', 'failed'].includes(booking.bookingStatus));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-4 py-4 flex items-center justify-between sticky top-0 z-10 border-b">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/orders')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Track Order</h1>
            <p className="text-xs text-gray-500">#{order.orderNumber}</p>
          </div>
        </div>
        {order.orderStatus === 'pending' && user?.uid === order.customerId && (
          <button
            onClick={handleCancelOrder}
            disabled={cancelling}
            className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Order'}
          </button>
        )}
      </header>

      {/* Map View */}
      <div className="h-[280px] relative">
        <Map
          defaultCenter={{ lat: order.addressSnapshot?.latitude || 20.5937, lng: order.addressSnapshot?.longitude || 78.9629 }}
          defaultZoom={13}
          mapId="track-order-map"
          disableDefaultUI={true}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          {restaurant && (
            <AdvancedMarker
              position={{ lat: restaurant.latitude, lng: restaurant.longitude }}
              title={restaurant.restaurantName}
            >
              <div className="bg-white p-2 rounded-full shadow-lg border-2 border-orange-500">
                <Package className="w-5 h-5 text-orange-500" />
              </div>
            </AdvancedMarker>
          )}

          {order.addressSnapshot?.latitude && (
            <AdvancedMarker
              position={{ 
                lat: order.addressSnapshot.latitude, 
                lng: order.addressSnapshot.longitude 
              }}
              title="Delivery Location"
            >
              <div className="bg-white p-2 rounded-full shadow-lg border-2 border-blue-500">
                <MapPin className="w-5 h-5 text-blue-500" />
              </div>
            </AdvancedMarker>
          )}
        </Map>

        {/* Floating Google Maps Coordinate & Directions Buttons */}
        {order.addressSnapshot?.latitude && (
          <div className="absolute bottom-6 right-4 flex flex-wrap items-center gap-2">
            <a 
              href={getGoogleMapsCoordUrl(order.addressSnapshot.latitude, order.addressSnapshot.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 text-white px-3.5 py-2 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-bold hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Google Maps ({order.addressSnapshot.latitude.toFixed(4)}, {order.addressSnapshot.longitude.toFixed(4)})
            </a>
            <a 
              href={`https://www.google.com/maps/dir/?api=1&origin=${restaurant ? `${restaurant.latitude},${restaurant.longitude}` : ''}&destination=${order.addressSnapshot.latitude},${order.addressSnapshot.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white px-3.5 py-2 rounded-full shadow-lg border border-gray-100 flex items-center gap-1.5 text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-500" />
              Directions
            </a>
          </div>
        )}
      </div>

      {/* Tracking Info Card */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 relative z-10 shadow-2xl p-6 space-y-6 max-w-2xl mx-auto w-full">
        {order.orderStatus === 'cancelled' ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-700">
            <XCircle className="w-8 h-8 shrink-0 text-red-500" />
            <div>
              <h2 className="font-black text-lg">Order Cancelled</h2>
              <p className="text-xs text-red-600">This order was cancelled and will not be fulfilled.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-gray-900">
                  {order.orderStatus === 'delivered'
                    ? 'Order Delivered!'
                    : order.orderStatus === 'out_for_delivery'
                    ? 'Order is Out for Delivery'
                    : order.orderStatus === 'ready_for_pickup'
                    ? 'Order Ready for Pickup'
                    : order.orderStatus === 'preparing'
                    ? 'Kitchen is Preparing Food'
                    : order.orderStatus === 'confirmed'
                    ? 'Restaurant Accepted Order'
                    : 'Waiting for Restaurant Confirmation'}
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  {order.orderStatus === 'delivered'
                    ? `Paid via Cash on Delivery${order.deliveryVerifiedByWebhook ? ' • Webhook Verified' : ''}`
                    : `Estimated arrival in ~${order.deliveryEstimatedEtaMin || 30} mins`}
                </p>
              </div>
              <div className="bg-orange-50 p-3 rounded-2xl">
                <Clock className="w-6 h-6 text-orange-500" />
              </div>
            </div>

            {/* Status Stepper */}
            <div className="flex justify-between relative px-1 overflow-x-auto pb-2">
              <div className="absolute top-5 left-6 right-6 h-0.5 bg-gray-100 -z-10" />
              <div 
                className="absolute top-5 left-6 h-0.5 bg-orange-500 transition-all duration-700 -z-10"
                style={{ width: `${Math.min(100, (currentStepIndex / (steps.length - 1)) * 90)}%` }}
              />
              
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                
                return (
                  <div key={step.status} className="flex flex-col items-center gap-2 min-w-[52px]">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border-4 ${
                      isActive ? 'bg-orange-500 border-orange-100 text-white' : 'bg-white border-gray-50 text-gray-300'
                    } ${isCurrent ? 'scale-110 shadow-lg ring-4 ring-orange-50' : ''}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-bold text-center ${
                      isActive ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Third-Party & Local Delivery Booking & Live Tracking Section */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-500" />
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Delivery Service & Booking Status</h3>
                <p className="text-xs text-gray-500">
                  Selected: <span className="font-semibold text-gray-800">{booking?.providerName || order.selectedDeliveryProviderName || "Restaurant's Own Delivery Staff"}</span>
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
              booking?.bookingStatus === 'delivered' ? 'bg-green-100 text-green-700' :
              booking?.bookingStatus === 'failed' || booking?.bookingStatus === 'cancelled' ? 'bg-red-100 text-red-700' :
              hasActiveBooking ? 'bg-blue-100 text-blue-700' :
              'bg-amber-100 text-amber-800'
            }`}>
              {(booking?.bookingStatus || order.deliveryBookingStatus || 'awaiting_restaurant_acceptance').replace(/_/g, ' ')}
            </span>
          </div>

          {deliveryNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between">
              <span>{deliveryNotice}</span>
              <button onClick={() => setDeliveryNotice(null)} className="text-[10px] uppercase font-black ml-2">OK</button>
            </div>
          )}

          {deliveryError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p>{deliveryError}</p>
                    <p className="text-[11px] font-medium mt-1">Select an alternative delivery option below — you will never be charged twice.</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await copyToClipboardSafe(deliveryError);
                      setCopiedError(true);
                      setTimeout(() => setCopiedError(false), 2000);
                    }}
                    className="px-2 py-1 bg-white border border-red-200 rounded-lg text-[10px] font-black text-red-600 flex items-center gap-1"
                  >
                    {copiedError ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedError ? 'Copied' : 'Copy Error'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setErrorWindowOpen(true)}
                    className="px-2 py-1 bg-red-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1"
                  >
                    <Bug className="w-3 h-3" />
                    Errors
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* State 1: Order still pending restaurant acceptance */}
          {order.orderStatus === 'pending' && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900">
              <strong>Awaiting Restaurant Confirmation:</strong> Per platform rules, your delivery booking will be dispatched only after the restaurant accepts your order.
            </div>
          )}

          {/* State 2: Restaurant accepted order, ready to book (or reassign after failed/cancelled booking) */}
          {isOrderAccepted && !hasActiveBooking && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <p className="text-xs font-bold text-gray-800">
                {booking?.bookingStatus === 'failed'
                  ? 'Previous booking failed. Choose an available delivery provider to reassign (no extra charge):'
                  : 'Restaurant accepted your order! Confirm your delivery method to dispatch a rider:'}
              </p>

              {eligibleQuotes.length > 0 && (
                <div className="space-y-2">
                  {eligibleQuotes.map(q => (
                    <label
                      key={q.providerId}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedProviderId === q.providerId ? 'border-orange-500 bg-white shadow-sm' : 'border-gray-200 bg-white/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="deliveryProvider"
                          checked={selectedProviderId === q.providerId}
                          onChange={() => setSelectedProviderId(q.providerId)}
                          className="accent-orange-500"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-900">{q.providerName}</span>
                            {q.isTestMockProvider && (
                              <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                Sandbox Test
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500">~{q.estimatedDurationMin} mins • {q.coverageMatchDetails}</p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-orange-600">₹{q.estimatedFee}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleBookDelivery(false)}
                  disabled={bookingLoading}
                  className="flex-1 py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Confirm & Book Delivery Service
                </button>
                <button
                  onClick={() => handleBookDelivery(true)}
                  disabled={bookingLoading}
                  className="py-3 px-3 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-[11px] font-bold"
                  title="Simulate a provider API failure to test fallback & reassignment"
                >
                  Test Failed Booking
                </button>
              </div>
            </div>
          )}

          {/* State 3: Active Delivery Booking Details */}
          {booking && (
            <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Booking ID</span>
                  <span className="font-mono font-bold text-gray-900">{booking.providerBookingRef}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Tracking Ref</span>
                  <span className="font-mono font-bold text-orange-600">{booking.trackingRef || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Quoted Delivery Fee</span>
                  <span className="font-bold text-gray-900">₹{booking.quotedFee} (Included in COD)</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Assigned Rider</span>
                  <span className="font-bold text-gray-900">{booking.riderName || 'Assigning...'}</span>
                </div>
              </div>

              {booking.failureReason && booking.bookingStatus === 'failed' && (
                <p className="text-red-600 font-semibold bg-red-50 p-2 rounded-lg">
                  Failure Reason: {booking.failureReason}
                </p>
              )}

              {/* Verified Sandbox Webhook Controls for Testing Live Delivery Updates */}
              {hasActiveBooking && booking.bookingStatus !== 'delivered' && (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Sandbox / Partner Webhook Simulator (HMAC-SHA256 Verified)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['rider_assigned', 'picked_up', 'in_transit', 'delivered'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleSandboxWebhook(st)}
                        disabled={Boolean(webhookLoading)}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-orange-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                      >
                        {webhookLoading === st ? '...' : `Webhook: ${st.replace(/_/g, ' ')}`}
                      </button>
                    ))}
                    <button
                      onClick={() => handleCancelOrReassignDelivery()}
                      disabled={bookingLoading}
                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Cancel / Reassign
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delivery Booking Status History */}
          {deliveryHistory.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery Provider Logs</p>
              {deliveryHistory.map((h) => (
                <div key={h.historyId} className="text-[11px] flex items-start justify-between gap-2 text-gray-600">
                  <div>
                    <span className="font-bold uppercase text-gray-800">{h.status.replace(/_/g, ' ')}</span>
                    <span className="text-gray-400 mx-1">[{h.source}]</span>
                    <span>{h.note}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Restaurant Contact */}
        <div className="pt-4 border-t flex items-center gap-4">
          <img 
            src={restaurant?.logoPath || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop'} 
            alt={restaurant?.restaurantName || order.restaurantName}
            className="w-12 h-12 rounded-xl object-cover bg-gray-100"
          />
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">{restaurant?.restaurantName || order.restaurantName}</h3>
            <p className="text-xs text-gray-500">{(order.itemsSnapshot || order.items || []).length} items • COD ₹{order.totalAmount}</p>
          </div>
          {restaurant?.phone && (
            <a 
              href={`tel:${restaurant.phone}`}
              className="p-3 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors flex items-center gap-2 text-xs font-bold text-orange-600"
            >
              <Phone className="w-4 h-4" />
              Call Kitchen
            </a>
          )}
        </div>

        {/* Delivery Address & GPS Coordinates */}
        <div className="pt-4 border-t flex flex-wrap items-start justify-between gap-3 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
            <div>
              <p className="font-semibold text-gray-900">Delivery Address ({order.customerName})</p>
              <p className="text-gray-500 leading-tight mt-0.5">{order.addressSnapshot?.formattedAddress}</p>
              {order.addressSnapshot?.latitude && (
                <p className="text-xs font-mono font-bold text-slate-600 mt-1">
                  GPS: {order.addressSnapshot.latitude.toFixed(6)}, {order.addressSnapshot.longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>
          {order.addressSnapshot?.latitude && (
            <a
              href={getGoogleMapsCoordUrl(order.addressSnapshot.latitude, order.addressSnapshot.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Google Maps</span>
            </a>
          )}
        </div>

        {/* Itemized Order & Bill Summary */}
        <div className="pt-4 border-t space-y-2">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Order Details</h4>
          {(order.itemsSnapshot || order.items || []).map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between text-sm">
              <div>
                <span className="font-bold text-gray-900">{item.quantity}x {item.name}</span>
                {item.variant && <span className="text-xs text-gray-500 ml-1">({item.variant.name})</span>}
                {item.selectedAddOns?.length > 0 && (
                  <p className="text-xs text-gray-400">
                    + {item.selectedAddOns.map((a: any) => a.option?.name || '').filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <span className="font-semibold text-gray-800">₹{item.lineTotal ?? item.price ?? 0}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-dashed flex justify-between text-xs text-gray-500">
            <span>Item Subtotal</span>
            <span>₹{order.itemSubtotal}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Delivery Fee</span>
            <span>₹{order.deliveryCharge}</span>
          </div>
          <div className="pt-2 border-t flex justify-between text-sm font-black text-gray-900">
            <span>Final COD Payable</span>
            <span className="text-orange-600">₹{order.totalAmount}</span>
          </div>
        </div>

        {/* Status Change Timestamps */}
        {order.statusHistory && order.statusHistory.length > 0 && (
          <div className="pt-4 border-t space-y-2">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Order Status History</h4>
            <div className="space-y-1.5">
              {order.statusHistory.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                  <span className="font-bold capitalize">{h.status.replace(/_/g, ' ')}</span>
                  <span className="text-gray-400">{new Date(h.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackOrderScreen;
