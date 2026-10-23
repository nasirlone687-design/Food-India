import React, { useState, useEffect } from 'react';
import { PluginMapSettings, PluginRestaurant, PluginDeliveryPartner } from '../models/types';
import { pluginSettingsService } from '../services/pluginSettingsService';
import { pluginRestaurantService } from '../services/pluginRestaurantService';
import { pluginDeliveryPartnerService } from '../services/pluginDeliveryPartnerService';
import {
  Store,
  CheckCircle2,
  XCircle,
  Power,
  MapPin,
  ShieldCheck,
  Truck,
  DollarSign,
  Eye,
  FileText,
  X,
  ExternalLink,
} from 'lucide-react';

export const PluginAdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<PluginMapSettings | null>(null);
  const [restaurants, setRestaurants] = useState<PluginRestaurant[]>([]);
  const [partners, setPartners] = useState<PluginDeliveryPartner[]>([]);
  const [activeTab, setActiveTab] = useState<'restaurants' | 'partners'>('restaurants');
  const [saving, setSaving] = useState(false);

  // Document Inspection Modal State
  const [inspectingPartner, setInspectingPartner] = useState<PluginDeliveryPartner | null>(null);
  const [activeDocTab, setActiveDocTab] = useState<'identity' | 'license' | 'vehicleRc' | 'insurance'>('identity');

  useEffect(() => {
    const unsubSettings = pluginSettingsService.subscribeSettings((s) => {
      setSettings(s);
    });
    const unsubRest = pluginRestaurantService.subscribeAllRestaurants((list) => {
      setRestaurants(list);
    });
    const unsubPartners = pluginDeliveryPartnerService.subscribeAllPartners((list) => {
      setPartners(list);
    });
    return () => {
      unsubSettings();
      unsubRest();
      unsubPartners();
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

  const handleApprovePartner = async (partnerId: string) => {
    await pluginDeliveryPartnerService.approvePartner(partnerId);
    if (inspectingPartner?.partnerId === partnerId) {
      setInspectingPartner({ ...inspectingPartner, approvalStatus: 'approved' });
    }
  };

  const handleRejectPartner = async (partnerId: string) => {
    await pluginDeliveryPartnerService.rejectPartner(partnerId);
    if (inspectingPartner?.partnerId === partnerId) {
      setInspectingPartner({ ...inspectingPartner, approvalStatus: 'rejected' });
    }
  };

  // Document Preview Renderer
  const renderDocPreview = (docUrl?: string, docName?: string) => {
    if (!docUrl) {
      return (
        <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center text-slate-400 italic text-xs">
          No document uploaded for this section.
        </div>
      );
    }

    if (docUrl.startsWith('data:image/')) {
      return (
        <div className="space-y-2 text-center">
          <div className="bg-slate-900 rounded-2xl p-2 inline-block max-w-full overflow-hidden shadow-inner">
            <img
              src={docUrl}
              alt={docName || 'Verification Document'}
              className="max-h-80 object-contain rounded-xl mx-auto"
            />
          </div>
          <p className="text-[11px] font-mono text-slate-500">Image Payload Verified (Saved in Firestore)</p>
        </div>
      );
    }

    if (docUrl.startsWith('data:application/pdf')) {
      return (
        <div className="space-y-2">
          <iframe
            src={docUrl}
            title={docName || 'PDF Document'}
            className="w-full h-80 rounded-2xl border border-slate-200 shadow-sm"
          />
          <a
            href={docUrl}
            download="verification-doc.pdf"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"
          >
            <ExternalLink size={14} />
            <span>Download Uploaded PDF Document</span>
          </a>
        </div>
      );
    }

    return (
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
        <span className="font-bold text-slate-500 uppercase text-[10px]">Document Reference / ID Payload:</span>
        <p className="font-mono bg-white p-3 rounded-xl border border-slate-200 text-slate-900 break-all select-all">
          {docUrl}
        </p>
      </div>
    );
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
            <h3 className="font-black text-sm uppercase">Restaurant Map & Dispatch Plugin</h3>
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('restaurants')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
            activeTab === 'restaurants'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Store size={14} />
          <span>Map Kitchens ({restaurants.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('partners')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
            activeTab === 'partners'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Truck size={14} />
          <span>Delivery Partners ({partners.length})</span>
          {partners.filter((p) => p.approvalStatus === 'pending').length > 0 && (
            <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full animate-pulse ml-1">
              {partners.filter((p) => p.approvalStatus === 'pending').length} PENDING
            </span>
          )}
        </button>
      </div>

      {/* Restaurant Approval Management */}
      {activeTab === 'restaurants' && (
        <div className="space-y-3">
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
      )}

      {/* Delivery Partners Approval & ₹299 Subscriptions Tab */}
      {activeTab === 'partners' && (
        <div className="space-y-3">
          {[...partners]
            .sort((a, b) => {
              if (a.approvalStatus === 'pending' && b.approvalStatus !== 'pending') return -1;
              if (a.approvalStatus !== 'pending' && b.approvalStatus === 'pending') return 1;
              return 0;
            })
            .map((p) => (
              <div
                key={p.partnerId}
                className={`p-4 rounded-2xl space-y-3 text-xs border transition-all ${
                  p.approvalStatus === 'pending'
                    ? 'bg-amber-50/80 border-amber-300 shadow-md ring-2 ring-amber-400/30'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                {p.approvalStatus === 'pending' && (
                  <div className="flex items-center justify-between bg-amber-200/80 text-amber-950 font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl">
                    <span>🚨 NEW DELIVERY BOY REGISTRATION REQUEST — VERIFY DOCUMENTS</span>
                    <span>ACTION REQUIRED</span>
                  </div>
                )}

                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-black text-slate-900 text-sm">{p.name}</h5>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[9px] uppercase rounded">
                        {p.vehicleType} ({p.vehicleNumber})
                      </span>
                    </div>
                    <p className="text-slate-500 font-bold mt-0.5">
                      Phone: {p.phone} • Rates: ₹{p.baseDeliveryPrice} base + ₹{p.pricePerKm}/km
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-1 rounded text-[10px] font-black uppercase ${
                        p.approvalStatus === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-200 text-amber-900 border border-amber-300 animate-pulse'
                      }`}
                    >
                      {p.approvalStatus}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-black text-[9px] uppercase rounded">
                      ₹299 Sub: {p.subscriptionStatus}
                    </span>
                  </div>
                </div>

              {/* Uploaded Verification Documents Preview Summary */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="min-w-0">
                  <span className="font-bold text-slate-400 uppercase">Identity:</span>
                  <p className="font-mono text-slate-800 truncate">
                    {p.identityDocUrl?.startsWith('data:')
                      ? '📄 File Attached'
                      : p.identityDocUrl || 'Aadhaar ID'}
                  </p>
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-400 uppercase">Licence:</span>
                  <p className="font-mono text-slate-800 truncate">
                    {p.licenseDocUrl?.startsWith('data:')
                      ? '📄 File Attached'
                      : p.licenseDocUrl || 'DL Copy'}
                  </p>
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-400 uppercase">Vehicle RC:</span>
                  <p className="font-mono text-slate-800 truncate">
                    {p.vehicleRcUrl?.startsWith('data:')
                      ? '📄 File Attached'
                      : p.vehicleRcUrl || 'RC Certificate'}
                  </p>
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-400 uppercase">Insurance:</span>
                  <p className="font-mono text-slate-800 truncate">
                    {p.vehicleInsuranceUrl?.startsWith('data:')
                      ? '📄 File Attached'
                      : p.vehicleInsuranceUrl || 'Policy Doc'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setInspectingPartner(p);
                    setActiveDocTab('identity');
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-wider flex items-center gap-1.5 shadow-sm"
                >
                  <Eye size={13} className="text-orange-400" />
                  <span>Inspect All 4 Documents</span>
                </button>

                <div className="flex gap-2">
                  {p.approvalStatus !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleApprovePartner(p.partnerId)}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold uppercase text-[10px]"
                    >
                      Approve Partner
                    </button>
                  )}
                  {p.approvalStatus !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => handleRejectPartner(p.partnerId)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-xl font-bold uppercase text-[10px]"
                    >
                      Reject Partner
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {partners.length === 0 && (
            <p className="text-center py-6 text-slate-400 italic text-xs">
              No delivery partners registered yet.
            </p>
          )}
        </div>
      )}

      {/* Document Inspection & Verification Modal */}
      {inspectingPartner && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 space-y-5 border border-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setInspectingPartner(null)}
              className="absolute top-5 right-5 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-xl font-black">
                🛵
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">{inspectingPartner.name}</h3>
                <p className="text-xs text-slate-500 font-bold">
                  {inspectingPartner.vehicleType.toUpperCase()} ({inspectingPartner.vehicleNumber}) • Phone: {inspectingPartner.phone}
                </p>
              </div>
            </div>

            {/* Document Navigation Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveDocTab('identity')}
                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${
                  activeDocTab === 'identity'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileText size={13} />
                <span>1. Identity</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDocTab('license')}
                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${
                  activeDocTab === 'license'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck size={13} />
                <span>2. Licence</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDocTab('vehicleRc')}
                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${
                  activeDocTab === 'vehicleRc'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Truck size={13} />
                <span>3. Vehicle RC</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDocTab('insurance')}
                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${
                  activeDocTab === 'insurance'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileText size={13} />
                <span>4. Insurance</span>
              </button>
            </div>

            {/* Document Preview Display */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 min-h-[220px]">
              {activeDocTab === 'identity' &&
                renderDocPreview(inspectingPartner.identityDocUrl, 'Identity Document')}
              {activeDocTab === 'license' &&
                renderDocPreview(inspectingPartner.licenseDocUrl, 'Driving Licence Document')}
              {activeDocTab === 'vehicleRc' &&
                renderDocPreview(inspectingPartner.vehicleRcUrl, 'Vehicle Registration Certificate (RC)')}
              {activeDocTab === 'insurance' &&
                renderDocPreview(inspectingPartner.vehicleInsuranceUrl, 'Vehicle Insurance / Permit Document')}
            </div>

            {/* Modal Bottom Verification Action Controls */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Current Status:</span>
                <span
                  className={`px-2.5 py-1 rounded text-[10px] font-black uppercase ${
                    inspectingPartner.approvalStatus === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {inspectingPartner.approvalStatus}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRejectPartner(inspectingPartner.partnerId)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-sm"
                >
                  Reject Partner
                </button>
                <button
                  type="button"
                  onClick={() => handleApprovePartner(inspectingPartner.partnerId)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-wider text-xs shadow-sm"
                >
                  Approve Partner ✓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

