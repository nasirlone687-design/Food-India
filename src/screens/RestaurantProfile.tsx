import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Restaurant, Product, Review } from '../models/types';
import {
  ChevronLeft,
  Star,
  Clock,
  Info,
  Search,
  MapPin,
  ExternalLink,
  MessageSquare,
  Send,
} from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getGoogleMapsCoordUrl } from '../utils/gps';
import { calculateDistance } from '../utils/helpers';
import { reviewService } from '../services/reviews';

const RestaurantProfile: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [menuSearchOpen, setMenuSearchOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  // Restaurant Review State
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;

    const unsubRes = onSnapshot(doc(db, 'restaurants', restaurantId), (resDoc) => {
      if (resDoc.exists()) {
        setRestaurant({ ...resDoc.data(), restaurantId: resDoc.id } as Restaurant);
      }
    }, () => {});

    const menuQuery = query(collection(db, 'products'), where('restaurantId', '==', restaurantId));
    const unsubscribeMenu = onSnapshot(menuQuery, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ ...d.data(), productId: d.id } as Product));
      list.sort((a, b) => Number(b.rating || 4.7) - Number(a.rating || 4.7));
      setMenuItems(list);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    const revQ = query(collection(db, 'reviews'), where('restaurantId', '==', restaurantId));
    const unsubRev = onSnapshot(revQ, (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), reviewId: d.id } as Review));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setReviews(list);
    }, () => {});

    return () => {
      unsubRes();
      unsubscribeMenu();
      unsubRev();
    };
  }, [restaurantId]);

  const handleSubmitRestaurantReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !restaurant) {
      navigate('/customer-auth');
      return;
    }
    setSubmittingReview(true);
    setReviewMsg(null);
    try {
      await reviewService.submitReview({
        targetType: 'restaurant',
        targetId: restaurant.restaurantId,
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.restaurantName,
        customerId: user.uid,
        customerName: profile?.fullName || user.displayName || 'Customer',
        rating: myRating,
        comment: myComment,
      });
      setMyComment('');
      setReviewMsg('Restaurant rating saved to database and your profile!');
      setTimeout(() => setReviewMsg(null), 4000);
    } catch (err) {
      console.error('Restaurant review error:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const { cart } = useCart();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );

  if (!restaurant) return <div className="p-8 text-center font-bold">Restaurant not found</div>;

  const customerGps = profile?.liveGps;
  const distanceKm =
    customerGps && typeof restaurant.latitude === 'number' && typeof restaurant.longitude === 'number'
      ? calculateDistance(
          customerGps.latitude,
          customerGps.longitude,
          restaurant.latitude,
          restaurant.longitude
        )
      : undefined;

  const itemCount = cart?.items.reduce((acc, i) => acc + i.quantity, 0) || 0;
  const filteredMenuItems = menuSearchQuery.trim()
    ? menuItems.filter(
        (item) =>
          item.name?.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(menuSearchQuery.toLowerCase())
      )
    : menuItems;

  return (
    <div className="min-h-screen bg-white pb-24 overflow-x-hidden max-w-[100vw]">
      {/* Cover Image & Back Button */}
      <div className="relative h-60 w-full">
        <img
          src={
            restaurant.coverImagePath ||
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop'
          }
          alt={restaurant.restaurantName}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-4 sm:left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg text-slate-900 active:scale-90 transition-transform"
        >
          <ChevronLeft size={24} strokeWidth={3} />
        </button>
      </div>

      {/* Restaurant Info Card */}
      <div className="px-4 sm:px-6 -mt-12 relative z-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="flex justify-between items-start gap-3 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">
                {restaurant.restaurantName}
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm font-medium">
                {restaurant.description || 'Delicious Indian Cuisine'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
              <Star size={24} fill="currentColor" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 py-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <Clock size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Preparation
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {restaurant.preparationTime || '25-35 min'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <Star size={16} className="text-yellow-500 fill-yellow-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Rating
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {Number(restaurant.rating || 4.7).toFixed(1)} (
                  {restaurant.totalReviews || reviews.length || 48}+)
                </span>
              </div>
            </div>
            {distanceKm !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <MapPin size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Distance
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-blue-600">
                    {distanceKm.toFixed(1)} km away
                  </span>
                </div>
              </div>
            )}
          </div>

          {typeof restaurant.latitude === 'number' && typeof restaurant.longitude === 'number' && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                <MapPin size={14} className="text-orange-500 shrink-0" />
                <span className="truncate font-medium">{restaurant.address}</span>
              </div>
              <a
                href={getGoogleMapsCoordUrl(restaurant.latitude, restaurant.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0"
              >
                <ExternalLink size={12} />
                <span>Open in Google Maps</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Menu Section */}
      <div className="px-4 sm:px-6 mt-8 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Full Menu ({filteredMenuItems.length})
          </h2>
          <button
            onClick={() => {
              setMenuSearchOpen((prev) => !prev);
              if (menuSearchOpen) setMenuSearchQuery('');
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              menuSearchOpen
                ? 'bg-orange-500 text-white'
                : 'bg-slate-50 text-slate-400 hover:text-slate-700'
            }`}
            title="Search Menu"
          >
            <Search size={20} />
          </button>
        </div>

        {menuSearchOpen && (
          <div className="relative">
            <input
              type="text"
              value={menuSearchQuery}
              onChange={(e) => setMenuSearchQuery(e.target.value)}
              placeholder="Search dishes in this restaurant..."
              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:border-orange-500"
            />
          </div>
        )}

        <div className="space-y-4">
          {filteredMenuItems.map((product) => (
            <ProductCard
              key={product.productId}
              product={{
                ...product,
                distanceKm,
                restaurantName: restaurant.restaurantName,
              }}
              onAdd={() => navigate(`/product/${product.productId}`)}
            />
          ))}
          {filteredMenuItems.length === 0 && (
            <div className="py-12 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <Info size={32} />
              </div>
              <p className="text-slate-400 font-medium">
                {menuSearchQuery
                  ? `No dishes matching "${menuSearchQuery}"`
                  : 'No items in the menu yet.'}
              </p>
            </div>
          )}
        </div>

        {/* Rate & Review Restaurant Card */}
        <div className="bg-slate-50 rounded-[32px] p-6 border border-slate-200 space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-orange-500" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Rate & Review {restaurant.restaurantName}
              </h3>
            </div>
            <span className="text-xs font-black text-amber-600 bg-white px-2.5 py-1 rounded-xl border border-amber-200">
              ★ {Number(restaurant.rating || 4.7).toFixed(1)}
            </span>
          </div>

          <form onSubmit={handleSubmitRestaurantReview} className="space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600 mr-1">Tap Stars:</span>
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
                placeholder="Write a review for this restaurant..."
                className="flex-1 h-12 px-4 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="px-4 h-12 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0"
              >
                <Send size={14} />
                <span>{submittingReview ? 'Saving...' : 'Submit'}</span>
              </button>
            </div>
          </form>

          {reviewMsg && (
            <p className="text-xs font-bold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              {reviewMsg}
            </p>
          )}

          {reviews.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200 max-h-56 overflow-y-auto">
              {reviews.slice(0, 6).map((rev) => (
                <div key={rev.reviewId} className="bg-white p-3 rounded-2xl border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">
                      {rev.customerName}{' '}
                      {rev.productName ? (
                        <span className="text-[10px] font-bold text-orange-600">
                          • {rev.productName}
                        </span>
                      ) : null}
                    </span>
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
      </div>

      {/* Sticky Bottom Cart Summary Bar */}
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 left-4 right-4 sm:left-6 sm:right-6 z-50 h-16 bg-orange-500 rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-between px-6 text-white max-w-2xl mx-auto"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                {itemCount} Item{itemCount > 1 ? 's' : ''}
              </span>
              <span className="text-lg font-black">₹{cart?.total || 0}</span>
            </div>
            <button
              onClick={() => navigate('/cart')}
              className="flex items-center gap-2 font-black uppercase tracking-widest text-sm"
            >
              View Cart
              <ChevronLeft size={20} className="rotate-180" strokeWidth={3} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RestaurantProfile;
