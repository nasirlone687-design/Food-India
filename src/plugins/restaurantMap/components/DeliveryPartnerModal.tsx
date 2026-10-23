import React from 'react';
import { PluginDeliveryPartner, PluginRestaurant } from '../models/types';
import {
  calculateRoundTripDistanceKm,
  calculatePartnerDeliveryCharge,
} from '../services/pluginDeliveryPartnerService';
import {
  X,
  Phone,
  MessageCircle,
  ShieldCheck,
  Truck,
  Navigation,
  MapPin,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface DeliveryPartnerModalProps {
  partner: PluginDeliveryPartner;
  onClose: () => void;
  selectedRestaurant?: PluginRestaurant | null;
  userLocation?: { lat: number; lng: number } | null;
  onSelectForOrder?: (partner: PluginDeliveryPartner, charge: number, roundTripKm: number) => void;
}

export const DeliveryPartnerModal: React.FC<DeliveryPartnerModalProps> = ({
  partner,
  onClose,
  selectedRestaurant,
  userLocation,
  onSelectForOrder,
}) => {
  const pLat = partner.latitude || 33.7297;
  const pLng = partner.longitude || 75.1498;

  const rLat = selectedRestaurant?.latitude || 33.7297;
  const rLng = selectedRestaurant?.longitude || 75.1498;

  const cLat = userLocation?.lat || 33.7297;
  const cLng = userLocation?.lng || 75.1498;

  // Calculate 3-leg live round-trip distance
  const roundTripKm = calculateRoundTripDistanceKm(pLat, pLng, rLat, rLng, cLat, cLng);

  // Calculate live delivery charge set by partner
  const deliveryCharge = calculatePartnerDeliveryCharge(
    roundTripKm,
    partner.baseDeliveryPrice || 20,
    partner.pricePerKm || 10
  );

  const cleanPhone = partner.phone.replace(/[^0-9]/g, '');
  const cleanWhatsapp = (partner.whatsappNumber || partner.phone).replace(/[^0-9]/g, '');

  const whatsappText = encodeURIComponent(
    `Hello ${partner.name}, I am contacting you from Food India Restaurant Map to request food delivery pickup.`
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-md">
              {partner.vehicleType === 'bike'
                ? '🏍️'
                : partner.vehicleType === 'auto'
                ? '🛺'
                : partner.vehicleType === 'van'
                ? '🚚'
                : '🛵'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-slate-900 text-base">{partner.name}</h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-md flex items-center gap-0.5">
                  <ShieldCheck size={11} /> Verified
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                {partner.vehicleType.toUpperCase()} • {partner.vehicleNumber}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Round Trip Distance & Rate Estimation */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                Live Round-Trip Distance
              </span>
              <p className="text-xl font-black text-emerald-950 flex items-center gap-1">
                <Navigation size={18} className="text-emerald-600" />
                <span>{roundTripKm} km Total</span>
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                Partner Delivery Fee
              </span>
              <p className="text-2xl font-black text-emerald-700">₹{deliveryCharge}</p>
            </div>
          </div>

          {/* Pricing breakdown */}
          <div className="text-[11px] font-semibold text-emerald-800 space-y-1 pt-2 border-t border-emerald-200/60">
            <div className="flex justify-between">
              <span>Base Delivery Charge:</span>
              <span className="font-bold">₹{partner.baseDeliveryPrice || 20}</span>
            </div>
            <div className="flex justify-between">
              <span>Distance Charge ({roundTripKm} km × ₹{partner.pricePerKm || 10}/km):</span>
              <span className="font-bold">₹{roundTripKm * (partner.pricePerKm || 10)}</span>
            </div>
            <p className="text-[9px] text-emerald-700 font-bold italic pt-1">
              * Measured 3-way round trip: Partner Vehicle ➔ Restaurant ➔ Customer ➔ Vehicle
            </p>
          </div>
        </div>

        {/* Documents Verification Status */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
          <p className="font-black text-slate-900 uppercase text-[10px] tracking-wider">
            Verified Partner Credentials & Documents
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-bold text-slate-700">
            <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span className="truncate">{partner.identityDocUrl || 'Aadhaar ID'}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span className="truncate">{partner.licenseDocUrl || 'Driving Licence'}</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span className="truncate">{partner.vehicleRcUrl || 'Vehicle RC'}</span>
            </div>
          </div>
        </div>

        {/* Direct Action Buttons: Call & WhatsApp */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <a
            href={`tel:${cleanPhone}`}
            className="py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            <Phone size={16} className="text-emerald-400" />
            <span>Call {partner.phone}</span>
          </a>

          <a
            href={`https://wa.me/${cleanWhatsapp}?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            <MessageCircle size={16} />
            <span>WhatsApp</span>
          </a>
        </div>

        {/* Option to select this partner for current order */}
        {onSelectForOrder && (
          <button
            type="button"
            onClick={() => onSelectForOrder(partner, deliveryCharge, roundTripKm)}
            className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-colors"
          >
            <Truck size={16} />
            <span>Use {partner.name.split(' ')[0]} for Order Delivery (₹{deliveryCharge})</span>
          </button>
        )}
      </div>
    </div>
  );
};
