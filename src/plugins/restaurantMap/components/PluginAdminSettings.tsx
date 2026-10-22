import React, { useState, useEffect } from 'react';
import { PluginMapSettings, PluginRestaurant } from '../models/types';
import { pluginSettingsService } from '../services/pluginSettingsService';
import { pluginRestaurantService } from '../services/pluginRestaurantService';
import { Store, CheckCircle2, XCircle, Power, MapPin, ShieldCheck } from 'lucide-react';

export const PluginAdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<PluginMapSettings | null>(null);
  const [restaurants, setRestaurants] = useState<PluginRestaurant[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubSettings = pluginSettingsService.subscribeSettings((s) => {
      setSettings(s);
    });
    const unsubRest = pluginRestaurantService.subscribeAllRestaurants((list) => {
      setRestaurants(list);
    });
    return () => {
      unsubSettings();
      unsubRest();
    };
  }, []);

  const handleTogglePlugin = async (enabled: boolean) => {
    setSaving(true);
    try {
      await pluginSettingsService.togglePluginStatus(enabled);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (restaurantId: string) => {
    await pluginRestaurantService.approveRestaurant(restaurantId);
  };

  const handleReject = async (restaurantId: string) => {
    await pluginRestaurantService.rejectRestaurant(restaurantId);
  };

  if (!settings) return null;

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 text-slate-800">
      {/* Plugin Main Switch */}
      <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white">
            <Power size={20} />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase">Restaurant Map Plugin</h3>
            <p className="text-[11px] text-slate-400 font-bold">
              {settings.isEnabled ? 'PLUGIN IS ACTIVE (ON)' : 'PLUGIN IS DISABLED (OFF)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => handleTogglePlugin(!settings.isEnabled)}
          className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md ${
            settings.isEnabled
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {settings.isEnabled ? 'Status: ON ✓' : 'Status: OFF'}
        </button>
      </div>

      {/* Restaurant Approval Management */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Store size={15} className="text-orange-500" />
            Registered Map Kitchens ({restaurants.length})
          </h4>
        </div>

        <div className="space-y-3">
          {restaurants.map((res) => (
            <div
              key={res.restaurantId}
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="font-black text-slate-900">{res.name}</h5>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      res.approvalStatus === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : res.approvalStatus === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {res.approvalStatus}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Owner: {res.ownerName} ({res.phone}) • {res.address}
                </p>
                <p className="text-[10px] font-mono text-slate-400">Slug: /r/{res.slug}</p>
              </div>

              <div className="flex gap-2">
                {res.approvalStatus !== 'approved' && (
                  <button
                    type="button"
                    onClick={() => handleApprove(res.restaurantId)}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold uppercase text-[10px]"
                  >
                    Approve
                  </button>
                )}
                {res.approvalStatus !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => handleReject(res.restaurantId)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-xl font-bold uppercase text-[10px]"
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>
          ))}

          {restaurants.length === 0 && (
            <p className="text-center py-6 text-slate-400 italic text-xs">
              No registered map kitchens found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
