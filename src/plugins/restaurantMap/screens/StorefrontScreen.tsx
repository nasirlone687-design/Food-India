import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PluginRestaurant, PluginMenuItem, PluginCartItem, PluginOrder } from '../models/types';
import { pluginRestaurantService } from '../services/pluginRestaurantService';
import { pluginOrderService } from '../services/pluginOrderService';
import { useAuth } from '../../../context/AuthContext';
import {
  ChevronLeft,
  MapPin,
  Clock,
  Star,
  Plus,
  Minus,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  Store,
  X,
} from 'lucide-react';

export const StorefrontScreen: React.FC = () => {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [restaurant, setRestaurant] = useState<PluginRestaurant | null>(null);
  const [menuItems, setMenuItems] = useState<PluginMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<PluginCartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState(profile?.fullName || user?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState(profile?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState(profile?.liveGps?.address || '');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<PluginOrder | null>(null);

  useEffect(() => {
    if (!restaurantSlug) return;
    const fetchStore = async () => {
      setLoading(true);
      const res = await pluginRestaurantService.getRestaurantBySlug(restaurantSlug);
      if (res) {
        setRestaurant(res);
        pluginRestaurantService.subscribeRestaurantMenu(res.restaurantId, (items) => {
          setMenuItems(items);
        });
      }
      setLoading(false);
    };
    fetchStore();
  }, [restaurantSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Store size={48} className="text-slate-300 mb-3" />
        <h2 className="text-lg font-black text-slate-900">Restaurant Storefront Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">The link `/r/{restaurantSlug}` is not registered.</p>
        <button
          type="button"
          onClick={() => navigate('/restaurant-map')}
          className="mt-4 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-black uppercase"
        >
          Explore Restaurant Map
        </button>
      </div>
    );
  }

  const handleUpdateQty = (item: PluginMenuItem, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.itemId);
      if (!existing) {
        if (delta > 0) return [...prev, { itemId: item.itemId, name: item.name, price: item.price, quantity: 1, foodType: item.foodType, imageUrl: item.imageUrl }];
        return prev;
      }
      const qty = existing.quantity + delta;
      if (qty <= 0) return prev.filter((c) => c.itemId !== item.itemId);
      return prev.map((c) => (c.itemId === item.itemId ? { ...c, quantity: qty } : c));
    });
  };

  const cartSubtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = restaurant.baseDeliveryFee ?? 25;
  const grandTotal = Math.round((cartSubtotal + deliveryFee) * 100) / 100;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim()) {
      setOrderError('Please enter a contact cell phone number.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setOrderError('Please enter delivery address details.');
      return;
    }

    setPlacingOrder(true);
    setOrderError(null);

    try {
      const order = await pluginOrderService.createOrder({
        customerId: user?.uid || `guest_${Date.now()}`,
        customerName: customerName.trim() || 'Verified Customer',
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        deliveryNote: deliveryNote.trim(),
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.name,
        restaurantPhone: restaurant.phone,
        sellerId: restaurant.sellerId,
        items: cart,
        deliveryFee,
      });

      setActiveOrder(order);
      setCart([]);
      setShowCheckout(false);
    } catch (err: any) {
      setOrderError(err?.message || 'Failed to place order.');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28 max-w-2xl mx-auto">
      {/* Header Banner */}
      <div className="relative h-48 bg-slate-900 overflow-hidden">
        {restaurant.coverUrl ? (
          <img src={restaurant.coverUrl} alt={restaurant.name} className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-500 to-slate-900" />
        )}

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-md rounded-xl text-slate-800 shadow"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div className="flex items-center gap-3">
            {restaurant.logoUrl && (
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md bg-white"
              />
            )}
            <div className="text-white drop-shadow">
              <h1 className="text-lg font-black">{restaurant.name}</h1>
              <p className="text-xs opacity-90">{(restaurant.cuisineTypes || []).join(', ')}</p>
            </div>
          </div>

          <span className="px-3 py-1 bg-amber-500 text-white font-black text-xs rounded-xl shadow">
            ★ {restaurant.rating || 4.8}
          </span>
        </div>
      </div>

      {/* Details Box */}
      <div className="p-4 bg-white border-b border-slate-200 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <MapPin size={14} className="text-orange-500 shrink-0" />
          <span>{restaurant.address}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500 font-bold">
          <span>Delivery: ₹{deliveryFee}</span>
          <span>Radius: {restaurant.deliveryRadiusKm || 15} km</span>
          <span className="text-emerald-600">● {restaurant.isOpen ? 'Accepting Orders' : 'Closed'}</span>
        </div>
      </div>

      {/* Menu List */}
      <div className="p-4 space-y-3">
        <h2 className="font-black text-slate-900 text-sm">Dishes & Direct Ordering</h2>

        {menuItems.map((item) => {
          const qty = (cart.find((c) => c.itemId === item.itemId) || {}).quantity || 0;
          return (
            <div key={item.itemId} className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm">{item.name}</h3>
                {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                <p className="text-xs font-black text-orange-600 mt-1">₹{item.price}</p>
              </div>

              <div className="shrink-0">
                {qty === 0 ? (
                  <button
                    type="button"
                    onClick={() => handleUpdateQty(item, 1)}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-xs uppercase"
                  >
                    Add
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-900 text-white rounded-xl p-1">
                    <button type="button" onClick={() => handleUpdateQty(item, -1)} className="p-1">
                      <Minus size={14} />
                    </button>
                    <span className="text-xs font-black px-1">{qty}</span>
                    <button type="button" onClick={() => handleUpdateQty(item, 1)} className="p-1">
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Cart Drawer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 text-white rounded-t-3xl shadow-2xl flex items-center justify-between max-w-2xl mx-auto z-40">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">{cart.length} Items</p>
            <p className="text-lg font-black text-orange-400">₹{grandTotal} COD</p>
          </div>

          <button
            type="button"
            onClick={() => setShowCheckout(true)}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase rounded-2xl"
          >
            Checkout Order
          </button>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-slate-900 text-base">Direct COD Order</h3>
              <button type="button" onClick={() => setShowCheckout(false)} className="p-1 text-slate-400">
                <X size={20} />
              </button>
            </div>

            {orderError && (
              <div className="p-3 bg-red-50 text-red-700 font-bold rounded-xl text-xs">{orderError}</div>
            )}

            <form onSubmit={handlePlaceOrder} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full h-11 px-3.5 bg-slate-50 border rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Cell Phone Number</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full h-11 px-3.5 bg-slate-50 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Delivery Address</label>
                <textarea
                  required
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full p-3 bg-slate-50 border rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={placingOrder}
                className="w-full py-3.5 bg-orange-500 text-white font-black uppercase rounded-2xl text-xs"
              >
                {placingOrder ? 'Placing Order...' : `Place Order (₹${grandTotal})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center space-y-3">
            <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
            <h3 className="font-black text-slate-900 text-lg">Order Placed!</h3>
            <p className="text-xs text-slate-500 font-mono font-bold">#{activeOrder.orderNumber}</p>
            <button
              type="button"
              onClick={() => setActiveOrder(null)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
