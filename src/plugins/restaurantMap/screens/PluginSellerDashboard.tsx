import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { PluginRestaurant, PluginMenuItem, PluginOrder, PluginOrderStatus } from '../models/types';
import { pluginRestaurantService } from '../services/pluginRestaurantService';
import { pluginOrderService } from '../services/pluginOrderService';
import {
  Store,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  ChevronLeft,
  Phone,
  MapPin,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const PluginSellerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState<PluginRestaurant | null>(null);
  const [menuItems, setMenuItems] = useState<PluginMenuItem[]>([]);
  const [orders, setOrders] = useState<PluginOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');

  // Add Item form state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    category: 'Main Course',
    price: 150,
    foodType: 'veg' as 'veg' | 'non-veg' | 'egg',
    imageUrl: '',
  });

  useEffect(() => {
    if (!user?.uid) return;
    const loadRestaurant = async () => {
      setLoading(true);
      const res = await pluginRestaurantService.getRestaurantBySellerId(user.uid);
      if (res) {
        setRestaurant(res);
        // Subscribe to seller's orders
        pluginOrderService.subscribeSellerOrders(user.uid, res.restaurantId, (list) => {
          setOrders(list);
        });
        // Subscribe to seller's menu
        pluginRestaurantService.subscribeRestaurantMenu(res.restaurantId, (items) => {
          setMenuItems(items);
        });
      }
      setLoading(false);
    };
    loadRestaurant();
  }, [user?.uid]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant || !newItem.name.trim()) return;

    await pluginRestaurantService.addMenuItem({
      restaurantId: restaurant.restaurantId,
      name: newItem.name.trim(),
      description: newItem.description.trim(),
      category: newItem.category.trim() || 'General',
      price: Number(newItem.price),
      foodType: newItem.foodType,
      isAvailable: true,
      imageUrl: newItem.imageUrl.trim() || undefined,
    });

    setNewItem({
      name: '',
      description: '',
      category: 'Main Course',
      price: 150,
      foodType: 'veg',
      imageUrl: '',
    });
    setShowAddItem(false);
  };

  const handleUpdateStatus = async (orderId: string, status: PluginOrderStatus) => {
    await pluginOrderService.updateOrderStatus(orderId, status);
  };

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
        <h2 className="text-lg font-black text-slate-900">No Map Plugin Restaurant Linked</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          You have not registered a kitchen in the Restaurant Map Plugin yet.
        </p>
        <button
          type="button"
          onClick={() => navigate('/restaurant-map')}
          className="mt-4 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-black uppercase shadow-md"
        >
          Register Kitchen on Map
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 max-w-3xl mx-auto">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 sm:p-6 rounded-b-3xl shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-base font-black truncate">{restaurant.name}</h1>
            <p className="text-xs text-slate-400 font-mono">
              Storefront: foodindia.sbs/r/{restaurant.slug}
            </p>
          </div>
        </div>

        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-black text-[10px] uppercase">
          {restaurant.approvalStatus}
        </span>
      </header>

      {/* Navigation Sub-Tabs */}
      <div className="p-4 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider ${
            activeTab === 'orders' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-600 border'
          }`}
        >
          Incoming Live Orders ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('menu')}
          className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider ${
            activeTab === 'menu' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-600 border'
          }`}
        >
          Manage Menu ({menuItems.length})
        </button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="p-4 space-y-4">
          {orders.map((order) => (
            <div key={order.orderId} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-mono font-black text-orange-600">#{order.orderNumber}</span>
                  <h3 className="font-bold text-slate-900 text-sm mt-0.5">{order.customerName}</h3>
                  <p className="text-xs font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone size={12} /> {order.customerPhone}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    order.orderStatus === 'pending'
                      ? 'bg-amber-100 text-amber-800'
                      : order.orderStatus === 'accepted'
                      ? 'bg-blue-100 text-blue-800'
                      : order.orderStatus === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {(order.orderStatus || 'pending').replace(/_/g, ' ')}
                </span>
              </div>

              {/* Items */}
              <div className="bg-slate-50 p-3 rounded-2xl space-y-1 text-xs">
                {(order.items || []).map((i) => (
                  <div key={i.itemId} className="flex justify-between text-slate-800 font-medium">
                    <span>
                      {i.quantity}x {i.name}
                    </span>
                    <span>₹{i.price * i.quantity}</span>
                  </div>
                ))}
                <div className="border-t pt-1 mt-1 flex justify-between font-black text-slate-900">
                  <span>Total COD Bill</span>
                  <span className="text-orange-600">₹{order.totalAmount}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 flex items-start gap-1">
                <MapPin size={14} className="text-orange-500 shrink-0 mt-0.5" />
                <span>{order.deliveryAddress}</span>
              </p>

              {/* Status Action Buttons */}
              <div className="pt-2 flex gap-2">
                {order.orderStatus === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.orderId, 'rejected')}
                      className="flex-1 py-2.5 bg-red-50 text-red-600 font-black text-xs uppercase rounded-xl"
                    >
                      Reject Order
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.orderId, 'accepted')}
                      className="flex-[2] py-2.5 bg-orange-500 text-white font-black text-xs uppercase rounded-xl shadow"
                    >
                      Accept Order
                    </button>
                  </>
                )}

                {order.orderStatus === 'accepted' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(order.orderId, 'preparing')}
                    className="w-full py-2.5 bg-blue-600 text-white font-black text-xs uppercase rounded-xl"
                  >
                    Mark as Preparing
                  </button>
                )}

                {order.orderStatus === 'preparing' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(order.orderId, 'delivering')}
                    className="w-full py-2.5 bg-indigo-600 text-white font-black text-xs uppercase rounded-xl"
                  >
                    Mark Out for Delivery
                  </button>
                )}

                {order.orderStatus === 'delivering' && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(order.orderId, 'delivered')}
                    className="w-full py-2.5 bg-emerald-600 text-white font-black text-xs uppercase rounded-xl"
                  >
                    Complete Delivery (COD Collected)
                  </button>
                )}
              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <p className="text-center py-12 text-slate-400 font-medium italic text-xs">
              No live orders received in map plugin yet.
            </p>
          )}
        </div>
      )}

      {/* Menu Management Tab */}
      {activeTab === 'menu' && (
        <div className="p-4 space-y-4">
          <button
            type="button"
            onClick={() => setShowAddItem(!showAddItem)}
            className="w-full py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow"
          >
            <Plus size={16} />
            <span>Add Dish to Map Menu</span>
          </button>

          {showAddItem && (
            <form onSubmit={handleAddItem} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <h3 className="font-black text-slate-900 text-sm">Add New Dish</h3>
              <div>
                <label className="font-bold text-slate-700">Dish Name</label>
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border rounded-xl"
                  placeholder="e.g. Mutton Rogan Josh"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                    className="w-full h-11 px-3 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Food Type</label>
                  <select
                    value={newItem.foodType}
                    onChange={(e) => setNewItem({ ...newItem, foodType: e.target.value as any })}
                    className="w-full h-11 px-3 bg-slate-50 border rounded-xl"
                  >
                    <option value="veg">Veg</option>
                    <option value="non-veg">Non-Veg</option>
                    <option value="egg">Egg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Category</label>
                <input
                  type="text"
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-50 border rounded-xl"
                  placeholder="Main Course, Biryani, Starters..."
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-500 text-white font-black text-xs uppercase rounded-xl"
              >
                Save Dish to Map Menu
              </button>
            </form>
          )}

          <div className="space-y-3">
            {menuItems.map((item) => (
              <div key={item.itemId} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                  <p className="text-xs text-slate-500">{item.category} • ₹{item.price}</p>
                </div>
                <button
                  type="button"
                  onClick={() => pluginRestaurantService.deleteMenuItem(item.itemId)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
