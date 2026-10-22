import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Product, Restaurant, AddOnGroup, Review } from '../models/types';
import {
  ChevronLeft,
  Plus,
  Minus,
  Star,
  Heart,
  Share2,
  Check,
  AlertCircle,
  MessageSquare,
  Send,
  MapPin,
} from 'lucide-react';
import { formatCurrency, calculateDistance } from '../utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { cartService } from '../services/carts';
import { reviewService } from '../services/reviews';

const ProductDetails: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedAddons, setSelectedAddons] = useState<{ groupName: string; option: any }[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Rating & Review Form State
  const [myRating, setMyRating] = useState<number>(5);
  const [myComment, setMyComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;

    let unsubRes: (() => void) | null = null;
    const unsubProd = onSnapshot(doc(db, 'products', productId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { ...docSnap.data(), productId: docSnap.id } as Product;
        setProduct(data);
        setSelectedVariant((prev: any) => prev || (data.variants && data.variants[0]) || null);

        if (data.restaurantId && !unsubRes) {
          unsubRes = onSnapshot(doc(db, 'restaurants', data.restaurantId), (resSnap) => {
            if (resSnap.exists()) {
              setRestaurant({ ...resSnap.data(), restaurantId: resSnap.id } as Restaurant);
            }
          }, () => {});
        }
      }
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    const revQ = query(collection(db, 'reviews'), where('productId', '==', productId));
    const unsubReviews = onSnapshot(revQ, (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), reviewId: d.id } as Review));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setReviews(list);
    }, () => {});

    return () => {
      unsubProd();
      if (unsubRes) unsubRes();
      unsubReviews();
    };
  }, [productId]);

  const handleSubmitDishReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !product) {
      navigate('/customer-auth');
      return;
    }
    setSubmittingReview(true);
    setReviewSuccess(null);
    try {
      await reviewService.submitReview({
        targetType: 'product',
        targetId: product.productId,
        productId: product.productId,
        productName: product.name,
        restaurantId: product.restaurantId,
        restaurantName: restaurant?.restaurantName,
        customerId: user.uid,
        customerName: profile?.fullName || user.displayName || 'Customer',
        rating: myRating,
        comment: myComment,
      });
      setMyComment('');
      setReviewSuccess('Thank you! Your rating & review have been saved to the dish, restaurant, and your profile.');
      setTimeout(() => setReviewSuccess(null), 4000);
    } catch (err) {
      console.error('Review submit error:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/customer-auth');
      return;
    }
    if (!product || !restaurant) return;

    if (product.addOnGroups && product.addOnGroups.length > 0) {
      for (const group of product.addOnGroups) {
        if (group.isRequired) {
          const count = selectedAddons.filter((a) => a.groupName === group.name).length;
          if (count === 0) {
            setValidationError(`Please select at least 1 option from "${group.name}" (Required).`);
            return;
          }
        }
      }
    }

    setValidationError(null);
    setAdding(true);
    try {
      const cartItem = {
        productId: product.productId,
        name: product.name,
        image: product.imagePaths?.[0] || '',
        basePrice: Number(product.price),
        variant: selectedVariant
          ? {
              id: selectedVariant.id || selectedVariant.name,
              name: selectedVariant.name,
              price: Number(selectedVariant.price ?? selectedVariant.priceDiff ?? 0),
            }
          : undefined,
        selectedAddOns: selectedAddons.map((a) => ({
          groupName: a.groupName,
          option: {
            id: a.option.id || a.option.name,
            name: a.option.name,
            price: Number(a.option.price || 0),
          },
        })),
        quantity,
      };
      await cartService.addToCart(user.uid, product, restaurant, cartItem);
      navigate('/cart');
    } catch (error) {
      console.error('Error adding to cart:', error);
      setValidationError('Could not add item to cart. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const toggleAddon = (group: AddOnGroup, option: any) => {
    setValidationError(null);
    const isSelected = selectedAddons.some(
      (a) => a.groupName === group.name && a.option.name === option.name
    );
    if (isSelected) {
      setSelectedAddons(
        selectedAddons.filter((a) => !(a.groupName === group.name && a.option.name === option.name))
      );
      return;
    }

    const currentGroupSelections = selectedAddons.filter((a) => a.groupName === group.name);
    const maxAllowed = group.maxSelections || 1;

    if (maxAllowed === 1) {
      const otherGroups = selectedAddons.filter((a) => a.groupName !== group.name);
      setSelectedAddons([...otherGroups, { groupName: group.name, option }]);
    } else if (currentGroupSelections.length >= maxAllowed) {
      setValidationError(`You can select up to ${maxAllowed} options for "${group.name}".`);
    } else {
      setSelectedAddons([...selectedAddons, { groupName: group.name, option }]);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );

  if (!product) return <div className="p-10 text-center font-bold">Product not found</div>;

  const images =
    product.imagePaths && product.imagePaths.length > 0
      ? product.imagePaths
      : ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=800&fit=crop'];

  const variantExtra = selectedVariant
    ? Number(selectedVariant.price ?? selectedVariant.priceDiff ?? 0)
    : 0;
  const addonsExtra = selectedAddons.reduce((sum, a) => sum + Number(a.option.price || 0), 0);
  const unitPrice = Number(product.price) + variantExtra + addonsExtra;
  const totalPrice = unitPrice * quantity;

  const customerGps = profile?.liveGps;
  const distanceKm =
    customerGps && restaurant?.latitude && restaurant?.longitude
      ? calculateDistance(
          customerGps.latitude,
          customerGps.longitude,
          restaurant.latitude,
          restaurant.longitude
        )
      : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-36 overflow-x-hidden max-w-[100vw]">
      {/* Header & Image Gallery */}
      <div className="relative bg-white h-[42vh] rounded-b-[40px] overflow-hidden shadow-sm">
        <AnimatePresence mode="wait">
          <motion.img
            key={activeImageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            src={images[activeImageIndex]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-4 sm:left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg text-slate-900 active:scale-90 transition-transform"
        >
          <ChevronLeft size={24} strokeWidth={3} />
        </button>

        <div className="absolute top-6 right-4 sm:right-6 flex flex-col gap-3">
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className={`w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform ${
              isFavorite ? 'text-red-500' : 'text-slate-900'
            }`}
          >
            <Heart size={20} className={isFavorite ? 'fill-red-500' : ''} />
          </button>
          <button
            onClick={handleShare}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg text-slate-900 active:scale-90 transition-transform relative"
          >
            <Share2 size={20} />
            {shareCopied && (
              <span className="absolute right-12 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap">
                Link Copied!
              </span>
            )}
          </button>
        </div>

        {images.length > 1 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  activeImageIndex === idx ? 'w-6 bg-white' : 'w-2 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <main className="px-4 sm:px-6 -mt-8 relative z-10 space-y-6 max-w-2xl mx-auto">
        {/* Title & Info Card */}
        <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="flex justify-between items-start gap-3 mb-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {product.name}
              </h1>
              {restaurant && (
                <button
                  type="button"
                  onClick={() => navigate(`/restaurant/${restaurant.restaurantId}`)}
                  className="text-xs font-bold text-orange-600 mt-1 hover:underline flex items-center gap-1.5"
                >
                  <span>{restaurant.restaurantName}</span>
                  {distanceKm !== null && (
                    <span className="inline-flex items-center gap-0.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      <MapPin size={11} /> {distanceKm.toFixed(1)} km away
                    </span>
                  )}
                </button>
              )}
            </div>
            <div
              className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center mt-1 shrink-0 ${
                product.isVeg ? 'border-green-600' : 'border-red-600'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  product.isVeg ? 'bg-green-600' : 'bg-red-600'
                }`}
              />
            </div>
          </div>

          <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">
            {product.description ||
              'Experience the authentic taste of Food India with this special dish prepared using fresh local ingredients.'}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Star size={16} className="text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-black text-slate-900">
                {Number(product.rating || 4.7).toFixed(1)}
              </span>
              <span className="text-xs font-bold text-slate-400">
                ({product.reviewCount || reviews.length || 24} reviews)
              </span>
            </div>
            <div className="w-1 h-1 bg-slate-200 rounded-full" />
            <div className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest">
              {product.preparationTimeMinutes || 20} min prep
            </div>
            <div className="w-1 h-1 bg-slate-200 rounded-full" />
            <div className="text-sm font-black text-orange-600">
              Base {formatCurrency(product.price)}
            </div>
          </div>
        </div>

        {/* Variants Selection */}
        {product.variants && product.variants.length > 0 && (
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">
              Choose Size / Variant
            </h3>
            <div className="space-y-3">
              {product.variants.map((v: any) => {
                const vPrice = Number(v.price ?? v.priceDiff ?? 0);
                return (
                  <button
                    key={v.name}
                    onClick={() => setSelectedVariant(v)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      selectedVariant?.name === v.name
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-100 bg-white'
                    }`}
                  >
                    <span
                      className={`font-bold text-left ${
                        selectedVariant?.name === v.name ? 'text-orange-600' : 'text-slate-600'
                      }`}
                    >
                      {v.name}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs sm:text-sm font-black text-slate-900">
                        {vPrice > 0 ? `+${formatCurrency(vPrice)}` : 'Included'} (
                        {formatCurrency(Number(product.price) + vPrice)})
                      </span>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedVariant?.name === v.name
                            ? 'border-orange-500'
                            : 'border-slate-200'
                        }`}
                      >
                        {selectedVariant?.name === v.name && (
                          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Add-on Groups */}
        {product.addOnGroups && product.addOnGroups.length > 0 && (
          <div className="space-y-6">
            {product.addOnGroups.map((group) => {
              const selectedCount = selectedAddons.filter(
                (a) => a.groupName === group.name
              ).length;
              return (
                <div
                  key={group.id || group.name}
                  className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                        {group.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {group.isRequired ? (
                          <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Required
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Optional
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-400">
                          ({selectedCount}/{group.maxSelections || 1} selected)
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Max {group.maxSelections || 1}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {group.options.map((opt) => {
                      const isSelected = selectedAddons.some(
                        (a) => a.groupName === group.name && a.option.name === opt.name
                      );
                      return (
                        <button
                          key={opt.name}
                          onClick={() => toggleAddon(group, opt)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-slate-100 bg-white'
                          }`}
                        >
                          <span
                            className={`text-sm font-bold text-left ${
                              isSelected ? 'text-orange-600' : 'text-slate-600'
                            }`}
                          >
                            {opt.name}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-black text-slate-900">
                              {Number(opt.price) > 0 ? `+₹${opt.price}` : 'Free'}
                            </span>
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                                isSelected
                                  ? 'border-orange-500 bg-orange-500'
                                  : 'border-slate-200'
                              }`}
                            >
                              {isSelected && (
                                <Check size={14} className="text-white" strokeWidth={4} />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quantity Controls */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Quantity</h3>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-900 active:bg-slate-200"
            >
              <Minus size={20} strokeWidth={3} />
            </button>
            <span className="text-xl font-black text-slate-900 w-6 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white active:bg-orange-600"
            >
              <Plus size={20} strokeWidth={3} />
            </button>
          </div>
        </div>

        {validationError && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold">
            <AlertCircle size={18} className="shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Rate & Review Dish Section (Saved to Product DB, Restaurant DB & User Profile) */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-orange-500" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Rate & Review This Dish
              </h3>
            </div>
            <span className="text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl">
              ★ {Number(product.rating || 4.7).toFixed(1)} ({product.reviewCount || reviews.length || 24})
            </span>
          </div>

          <form onSubmit={handleSubmitDishReview} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Your Rating:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setMyRating(star)}
                  className="p-1 active:scale-110 transition-transform"
                >
                  <Star
                    size={22}
                    className={
                      star <= myRating
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-slate-300'
                    }
                  />
                </button>
              ))}
              <span className="text-xs font-black text-slate-800 ml-1">{myRating}.0 / 5</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
                placeholder="Share your experience with this dish..."
                className="flex-1 h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="px-4 h-12 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0"
              >
                <Send size={14} />
                <span>{submittingReview ? 'Saving...' : 'Rate'}</span>
              </button>
            </div>
          </form>

          {reviewSuccess && (
            <p className="text-xs font-bold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              {reviewSuccess}
            </p>
          )}

          {reviews.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100 max-h-60 overflow-y-auto">
              {reviews.slice(0, 8).map((rev) => (
                <div key={rev.reviewId} className="bg-slate-50 p-3 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">{rev.customerName}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-black text-amber-600">
                      <Star size={12} className="fill-yellow-500 text-yellow-500" />
                      {rev.rating}.0
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{rev.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-white border-t border-slate-100 flex items-center gap-4 z-50">
        <div className="max-w-2xl mx-auto w-full flex items-center gap-4">
          <div className="flex flex-col min-w-[100px]">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Total Price
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {formatCurrency(totalPrice)}
            </span>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={adding}
            className="flex-1 h-14 sm:h-16 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-xl shadow-slate-900/20 disabled:opacity-50 text-xs sm:text-sm"
          >
            {adding ? 'Adding...' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
