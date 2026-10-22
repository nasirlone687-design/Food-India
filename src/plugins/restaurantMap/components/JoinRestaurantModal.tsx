import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { pluginRestaurantService } from '../services/pluginRestaurantService';
import { X, Store, MapPin, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface JoinRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered?: (restaurantId: string) => void;
}

export const JoinRestaurantModal: React.FC<JoinRestaurantModalProps> = ({
  isOpen,
  onClose,
  onRegistered,
}) => {
  const { user, profile } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    ownerName: profile?.fullName || user?.displayName || '',
    ownerEmail: user?.email || '',
    phone: profile?.phone || '',
    address: profile?.liveGps?.address || '',
    latitude: profile?.liveGps?.latitude || 33.7297,
    longitude: profile?.liveGps?.longitude || 75.1498,
    cuisineTypes: 'North Indian, Kashmiri Wazwan, Biryani',
    logoUrl: '',
    coverUrl: '',
    baseDeliveryFee: 25,
    deliveryRadiusKm: 15,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please enter your restaurant business name.');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Please enter a contact phone number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cuisineArr = formData.cuisineTypes
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const restaurantId = await pluginRestaurantService.registerRestaurant({
        sellerId: user?.uid || `seller_${Date.now()}`,
        name: formData.name.trim(),
        ownerName: formData.ownerName.trim(),
        ownerEmail: formData.ownerEmail.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        cuisineTypes: cuisineArr.length > 0 ? cuisineArr : ['Indian Cuisine'],
        logoUrl: formData.logoUrl.trim() || undefined,
        coverUrl: formData.coverUrl.trim() || undefined,
        baseDeliveryFee: Number(formData.baseDeliveryFee || 25),
        deliveryRadiusKm: Number(formData.deliveryRadiusKm || 15),
        isOpen: true,
      });

      setSuccess(true);
      setTimeout(() => {
        if (onRegistered) onRegistered(restaurantId);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to register restaurant in map plugin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Store size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Join as Restaurant</h3>
              <p className="text-xs text-slate-500 font-bold">Register on Food India Map Plugin</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Restaurant registered successfully! Redirecting...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-700">Restaurant Business Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-orange-500"
              placeholder="e.g. Royal Kashmiri Darbar"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Owner Name</label>
              <input
                type="text"
                required
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Phone Number *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Cuisines (comma separated)</label>
            <input
              type="text"
              value={formData.cuisineTypes}
              onChange={(e) => setFormData({ ...formData, cuisineTypes: e.target.value })}
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none"
              placeholder="North Indian, Wazwan, Biryani, Street Chaat"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Full Physical Address</label>
            <textarea
              required
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none"
              placeholder="Enter kitchen address, street, city, pin..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Latitude</label>
              <input
                type="number"
                step="any"
                required
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Longitude</label>
              <input
                type="number"
                step="any"
                required
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Logo Image URL</label>
              <input
                type="url"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Delivery Fee (₹)</label>
              <input
                type="number"
                value={formData.baseDeliveryFee}
                onChange={(e) => setFormData({ ...formData, baseDeliveryFee: parseFloat(e.target.value) })}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-13 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black uppercase tracking-wider rounded-2xl shadow-lg transition-colors flex items-center justify-center gap-2 mt-4 text-xs"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Registering Restaurant...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Submit Restaurant Registration</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
