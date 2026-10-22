import React from 'react';
import { Star, Clock, MapPin, Navigation } from 'lucide-react';
import { Restaurant } from '../models/types';

interface RestaurantCardProps {
  restaurant: Restaurant;
  onClick?: () => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({ restaurant, onClick }) => {
  const displayRating =
    typeof restaurant.rating === 'number' && restaurant.rating > 0
      ? restaurant.rating.toFixed(1)
      : '4.8';
  const reviewCount = restaurant.reviewCount || 0;
  const distText =
    typeof restaurant.distanceKm === 'number' && Number.isFinite(restaurant.distanceKm)
      ? restaurant.distanceKm < 1
        ? `${Math.max(10, Math.round(restaurant.distanceKm * 1000))} m from restaurant`
        : `${restaurant.distanceKm.toFixed(2)} km from restaurant`
      : `Max delivery ${restaurant.maximumDeliveryDistanceKm || 5} km`;

  const pinDisplay = restaurant.pincode || restaurant.postalCode || '';
  const locationLabel = [
    restaurant.locality,
    restaurant.city,
    restaurant.district,
    pinDisplay ? `PIN ${pinDisplay}` : '',
  ]
    .filter(Boolean)
    .join(', ') || restaurant.address || 'Verified Kitchen';

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 w-full text-left group bg-white p-3 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-all"
    >
      <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100">
        <img
          src={
            restaurant.coverImagePath ||
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=450&fit=crop'
          }
          alt={restaurant.restaurantName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {!restaurant.isOpen && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-white/90 text-slate-900 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
              Closed
            </span>
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-emerald-600/95 text-white backdrop-blur-md px-2.5 py-1 rounded-xl shadow-sm">
          <Navigation size={11} />
          <span className="text-[10px] font-black uppercase tracking-wider">{distText}</span>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-xl">
            <Star size={13} className="fill-amber-400 text-amber-400" />
            <span className="text-xs font-black">{displayRating}</span>
            {reviewCount > 0 && (
              <span className="text-[10px] text-white/80 font-bold">({reviewCount})</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-xl">
            <Clock size={13} />
            <span className="text-xs font-bold">{restaurant.preparationTime || '25-35 min'}</span>
          </div>
        </div>
      </div>

      <div className="px-1">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">
            {restaurant.restaurantName}
          </h3>
          <span className="text-orange-600 text-[10px] font-black uppercase tracking-wider shrink-0 ml-2 bg-orange-50 px-2 py-0.5 rounded-lg">
            100% COD
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-slate-500 text-xs font-medium">
          <div className="flex items-center gap-1 truncate">
            <MapPin size={12} className="text-orange-500 shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </div>
          <span className="text-[11px] font-black text-emerald-700 shrink-0">{distText}</span>
        </div>
      </div>
    </button>
  );
};
