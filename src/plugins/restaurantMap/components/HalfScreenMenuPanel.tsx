import React, { useState, useEffect } from 'react';
import { PluginRestaurant, PluginMenuItem, PluginCartItem, PluginOrder } from '../models/types';
import { pluginRestaurantService } from '../services/pluginRestaurantService';
import { pluginOrderService } from '../services/pluginOrderService';
import { useAuth } from '../../../context/AuthContext';
import {
  X,
  Plus,
  Minus,
  ShoppingBag,
  Clock,
  Star,
  MapPin,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  Truck,
  ExternalLink,
} from 'lucide-react';

interface HalfScreenMenuPanelProps {
  restaurant: PluginRestaurant;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
}

export const HalfScreenMenuPanel: React.FC<HalfScreenMenuPanelProps> = ({
  restaurant,
  onClose,
  userLocation,
}) => {
  const { user, profile } = useAuth();
  const [menuItems, setMenuItems] = useState<PluginMenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [cart, setCart] = useState<PluginCartItem[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);

  // Checkout form state
  const [customerName, setCustomerName] = useState(profile?.fullName || user?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState(profile?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState(profile?.liveGps?.address || '');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [placingOrder, setPlacingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<PluginOrder | null>(null);

  // Subscribe to live menu items from plugin_map_menus
  useEffect(() => {
    const unsub = pluginRestaurantService.subscribeRestaurantMenu(
      restaurant.restaurantId,
      (items) => {
        setMenuItems(items);
      }
    );
    return () => unsub();
  }, [restaurant.restaurantId]);

  // Sync profile details
  useEffect(() => {
    if (profile?.fullName) setCustomerName(profile.fullName);
    if (profile?.phone) setCustomerPhone(profile.phone);
    if (profile?.liveGps?.address && !deliveryAddress) {
      setDeliveryAddress(profile.liveGps.address);
    }
  }, [profile]);

  const categories = Array.from(new Set(menuItems.map((m) => m.category || 'General')));

  const filteredItems =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((m) => (m.category || 'General') === selectedCategory);

  const getItemQty = (itemId: string) => {
    const found = cart.find((c) => c.itemId === itemId);
    return found ? found.quantity : 0;
  };

  const handleUpdateQty = (item: PluginMenuItem, delta: number) => {
    setCart((prevCart) => {
      const existing = prevCart.find((c) => c.itemId === item.itemId);
      if (!existing) {
        if (delta > 0) {
          return [
            ...prevCart,
            {
              itemId: item.itemId,
              name: item.name,
              price: item.price,
              quantity: 1,
              foodType: item.foodType,
              imageUrl: item.imageUrl,
            },
          ];
        }
        return prevCart;
      }

      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        return prevCart.filter((c) => c.itemId !== item.itemId);
      }
      return prevCart.map((c) => (c.itemId === item.itemId ? { ...c, quantity: nextQty } : c));
    });
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = restaurant.baseDeliveryFee ?? 25;
  const grandTotal = Math.round((cartSubtotal + deliveryFee) * 100) / 100;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!customerPhone.trim()) {
      setOrderError('Please enter your 10-digit mobile number for order verification.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setOrderError('Please enter your delivery address or doorstep instructions.');
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
        customerLat: userLocation?.lat,
        customerLng: userLocation?.lng,
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.name,
        restaurantPhone: restaurant.phone,
        sellerId: restaurant.sellerId,
        items: cart,
        deliveryFee,
      });

      setActiveOrder(order);
      setCart([]);
      setShowCheckoutModal(false);
    } catch (err: any) {
      setOrderError(err?.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <>
      {/* Half-screen over the map / expandable panel */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 transition-all duration-300 flex flex-col max-w-2xl mx-auto ${
          isExpanded ? 'h-[92vh]' : 'h-[60vh]'
        }`}
      >
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white font-black flex items-center justify-center shrink-0">
                {restaurant.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 truncate">{restaurant.name}</h2>
                <span
                  className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                    restaurant.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {restaurant.isOpen ? 'Open Now' : 'Closed'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {(restaurant.cuisineTypes || []).join(', ')} • ★ {restaurant.rating || 4.8}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {typeof restaurant.latitude === 'number' && typeof restaurant.longitude === 'number' && (
              <a
                href={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-colors"
                title="Open Restaurant Coordinates in Google Maps"
              >
                <ExternalLink size={12} />
                <span className="hidden sm:inline">Google Maps</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-slate-500 hover:bg-slate-200 rounded-xl"
              title={isExpanded ? 'Collapse to half screen' : 'Expand full screen'}
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:bg-slate-200 rounded-xl"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        {categories.length > 0 && (
          <div className="px-4 py-2 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Items ({menuItems.length})
            </button>
            {categories.map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Menu Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredItems.map((item) => {
            const qty = getItemQty(item.itemId);
            const isVeg = item.foodType === 'veg';

            return (
              <div
                key={item.itemId}
                className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 hover:border-orange-200 transition-colors"
              >
                <div className="flex gap-3 min-w-0">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-100 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-3 h-3 rounded-sm border flex items-center justify-center ${
                          isVeg ? 'border-emerald-600' : 'border-red-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isVeg ? 'bg-emerald-600' : 'bg-red-600'
                          }`}
                        />
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm truncate">{item.name}</h3>
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {item.description}
                      </p>
                    )}
                    <p className="text-xs font-black text-orange-600 mt-1">₹{item.price}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {qty === 0 ? (
                    <button
                      type="button"
                      disabled={!item.isAvailable}
                      onClick={() => handleUpdateQty(item, 1)}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:bg-slate-200 disabled:text-slate-400 shadow-sm transition-colors"
                    >
                      {item.isAvailable ? 'Add' : 'Sold Out'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-slate-900 text-white rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item, -1)}
                        className="p-1 hover:bg-slate-700 rounded-lg"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-xs font-black px-1">{qty}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item, 1)}
                        className="p-1 hover:bg-slate-700 rounded-lg"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {menuItems.length === 0 && (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <ShoppingBag size={32} className="mx-auto text-slate-300" />
              <p className="text-sm font-medium">No menu items published yet for this restaurant.</p>
            </div>
          )}
        </div>

        {/* Bottom Cart Drawer Summary Bar */}
        {cart.length > 0 && (
          <div className="p-4 bg-slate-900 text-white rounded-t-3xl shadow-2xl flex items-center justify-between shrink-0">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">
                {cart.reduce((s, i) => s + i.quantity, 0)} Items Selected
              </p>
              <p className="text-lg font-black text-orange-400">₹{cartSubtotal} + ₹{deliveryFee} Fee</p>
            </div>

            <button
              type="button"
              onClick={() => setShowCheckoutModal(true)}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-orange-500/30 transition-colors flex items-center gap-2"
            >
              <span>Review Order & Checkout</span>
              <ShoppingBag size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Checkout Modal Overlay */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">Direct COD Order Checkout</h3>
                <p className="text-xs text-slate-500 font-bold">{restaurant.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {orderError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{orderError}</span>
              </div>
            )}

            {/* Cart Items Summary */}
            <div className="bg-slate-50 p-3.5 rounded-2xl space-y-2 text-xs border border-slate-100">
              <p className="font-black uppercase text-[10px] text-slate-400 tracking-wider">
                Order Items
              </p>
              {cart.map((i) => (
                <div key={i.itemId} className="flex justify-between font-bold text-slate-800">
                  <span>
                    {i.quantity}x {i.name}
                  </span>
                  <span>₹{i.price * i.quantity}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900 text-sm">
                <span>Total Payable (COD)</span>
                <span className="text-orange-600">₹{grandTotal}</span>
              </div>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Customer Name</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-orange-500"
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Cell Phone Number (Required for Seller Notification)</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-orange-500"
                  placeholder="+91 9876543210"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Delivery Address & Instructions</label>
                <textarea
                  required
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-orange-500"
                  placeholder="Enter complete door address, house number, landmark..."
                />
              </div>

              <button
                type="submit"
                disabled={placingOrder}
                className="w-full h-13 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg transition-colors flex items-center justify-center gap-2 text-xs"
              >
                {placingOrder ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Placing Direct Order...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Confirm & Place Direct COD Order (₹{grandTotal})</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Active Order Live Tracker Popup */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">Order Placed Successfully!</h3>
              <p className="text-xs font-mono font-black text-orange-600 mt-1">
                Order #{activeOrder.orderNumber}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Sent directly to <strong>{activeOrder.restaurantName}</strong> dashboard inside Food India.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl text-xs space-y-2 border border-slate-100 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Status:</span>
                <span className="font-black text-orange-600 uppercase">
                  {(activeOrder.orderStatus || 'pending').replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Total Bill:</span>
                <span className="font-bold text-slate-900">₹{activeOrder.totalAmount} (COD)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveOrder(null)}
              className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-wider"
            >
              Close & Return to Map
            </button>
          </div>
        </div>
      )}
    </>
  );
};
