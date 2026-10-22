import React, { useState } from 'react';
import { Plus, Minus, Star, MapPin, CheckCircle2 } from 'lucide-react';
import { Product } from '../models/types';
import { formatCurrency } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';
import { reviewService } from '../services/reviews';
import { useAuth } from '../context/AuthContext';

interface ProductCardProps {
  product: Product;
  quantity?: number;
  onAdd?: () => void;
  onRemove?: () => void;
  onClick?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantity = 0,
  onAdd,
  onRemove,
}) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [userStars, setUserStars] = useState<number | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);

  const isVeg =
    product.isVeg !== undefined
      ? product.isVeg
      : product.foodType !== 'non-veg' && product.foodType !== 'egg';
  const ratingVal = Number(product.rating || 4.7);
  const reviewCount = Number(product.reviewCount || 24);

  const handleRateProduct = async (e: React.MouseEvent, stars: number) => {
    e.stopPropagation();
    if (submittingRating) return;
    setSubmittingRating(true);
    setUserStars(stars);
    try {
      await reviewService.submitReview({
        targetType: 'product',
        targetId: product.productId,
        productId: product.productId,
        productName: product.name,
        restaurantId: product.restaurantId || '',
        restaurantName: product.restaurantName || 'Kitchen',
        customerId: user?.uid || 'guest_customer',
        customerName: profile?.fullName || user?.displayName || 'Verified Customer',
        rating: stars,
        comment: `Rated ${stars} star${stars > 1 ? 's' : ''} on dish card`,
      });
    } catch (err) {
      console.error('Error rating product:', err);
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-100 flex gap-3.5 hover:border-orange-200 transition-colors group max-w-full overflow-hidden">
      <div
        className="flex-1 min-w-0 flex flex-col justify-between min-h-[104px] cursor-pointer"
        onClick={() => navigate(`/product/${product.productId}`)}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                isVeg ? 'border-green-600' : 'border-red-600'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isVeg ? 'bg-green-600' : 'bg-red-600'
                }`}
              />
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-black">
              <Star size={10} className="fill-amber-500 text-amber-500" />
              {ratingVal.toFixed(1)} ({reviewCount})
            </span>
            {typeof product.distanceKm === 'number' && Number.isFinite(product.distanceKm) && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-black">
                <MapPin size={10} />
                {product.distanceKm.toFixed(1)} km
              </span>
            )}
          </div>
          <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight mb-1 group-hover:text-orange-600 transition-colors line-clamp-2">
            {product.name}
          </h4>
          {product.restaurantName && (
            <p className="text-[11px] font-bold text-orange-600 truncate mb-0.5">
              {product.restaurantName}
            </p>
          )}
          <p className="text-xs font-medium text-slate-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>

          {/* Interactive 1 to 5 Star Rating on ProductCard */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-2 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl w-fit border border-slate-100"
          >
            <span className="text-[9px] font-black uppercase text-slate-400">Rate Dish:</span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (userStars || Math.round(ratingVal)) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    disabled={submittingRating}
                    onClick={(e) => handleRateProduct(e, star)}
                    title={`Rate ${star} Star${star > 1 ? 's' : ''}`}
                    className="p-0.5 hover:scale-125 transition-transform"
                  >
                    <Star
                      size={13}
                      className={
                        active
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 hover:text-amber-300'
                      }
                    />
                  </button>
                );
              })}
            </div>
            {userStars && (
              <span className="text-[9px] font-black text-emerald-600 flex items-center gap-0.5">
                <CheckCircle2 size={10} /> Saved {userStars}★
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-black text-slate-900">
            {formatCurrency(product.price)}
          </span>
          {product.variants && product.variants.length > 0 && (
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-tight">
              Customisable
            </span>
          )}
        </div>
      </div>

      <div className="relative w-24 sm:w-28 h-24 sm:h-28 shrink-0">
        <div
          onClick={() => navigate(`/product/${product.productId}`)}
          className="w-full h-full rounded-2xl overflow-hidden bg-slate-50 cursor-pointer"
        >
          <img
            src={
              product.imagePaths?.[0] ||
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop'
            }
            alt={product.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 sm:w-24">
          {quantity > 0 ? (
            <div className="h-9 bg-white border border-orange-500 rounded-xl flex items-center justify-between px-1 shadow-lg shadow-orange-500/10">
              <button
                type="button"
                onClick={onRemove}
                className="w-7 h-7 flex items-center justify-center text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <Minus size={15} strokeWidth={3} />
              </button>
              <span className="text-xs sm:text-sm font-black text-orange-600">{quantity}</span>
              <button
                type="button"
                onClick={onAdd}
                className="w-7 h-7 flex items-center justify-center text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <Plus size={15} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="h-9 w-full bg-white border border-slate-200 text-orange-600 text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-slate-200/50 hover:border-orange-500 hover:bg-orange-50 transition-all active:scale-95"
            >
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
