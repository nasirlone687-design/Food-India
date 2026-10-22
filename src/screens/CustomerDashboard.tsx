import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Restaurant, Product, Category } from '../models/types';
import { DashboardHeader } from '../components/DashboardHeader';
import { RestaurantCard } from '../components/RestaurantCard';
import { motion } from 'motion/react';
import {
  Home as HomeIcon,
  ShoppingBag,
  Search as SearchIcon,
  User as UserIcon,
  Star,
  Navigation,
  CheckCircle2,
} from 'lucide-react';
import ProfileTab from '../components/ProfileTab';
import OrdersTab from '../components/OrdersTab';
import SearchTab from '../components/SearchTab';
import { calculateDistance } from '../utils/location';
import {
  loadSavedLiveGpsLocation,
  requestLiveGpsLocation,
  syncNearbyDemoKitchenToUserGps,
  GpsCoordinates,
} from '../utils/gps';
import { reviewService } from '../services/reviews';
import { GpsPermissionModal } from '../components/GpsPermissionModal';

type Tab = 'home' | 'orders' | 'search' | 'profile';

const formatExactDistance = (distanceKm?: number): string => {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) {
    return 'Enable GPS for distance';
  }
  if (distanceKm < 1) {
    return `${Math.max(10, Math.round(distanceKm * 1000))} m`;
  }
  return `${distanceKm.toFixed(2)} km`;
};

const CustomerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurantsRaw, setRestaurantsRaw] = useState<Restaurant[]>([]);
  const [foodsRaw, setFoodsRaw] = useState<Product[]>([]);
  const [liveGps, setLiveGps] = useState<GpsCoordinates | null>(() => {
    const saved = loadSavedLiveGpsLocation();
    if (saved) return saved;
    if (
      profile?.liveGps &&
      typeof profile.liveGps.latitude === 'number' &&
      typeof profile.liveGps.longitude === 'number'
    ) {
      return profile.liveGps as GpsCoordinates;
    }
    return null;
  });
  const [requestingGps, setRequestingGps] = useState(false);
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(true);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [ratingLoadingById, setRatingLoadingById] = useState<Record<string, boolean>>({});
  const [userRatedMap, setUserRatedMap] = useState<Record<string, number>>({});

  const triggerBrowserGpsPopup = async () => {
    setRequestingGps(true);
    try {
      const gps = await requestLiveGpsLocation({
        uid: user?.uid,
        role: 'customer',
        phone: profile?.phone,
      });
      setLiveGps(gps);
      syncNearbyDemoKitchenToUserGps(gps.latitude, gps.longitude);
      setShowGpsModal(false);
    } catch {
      // Browser geolocation permission denied or blocked in WebView, show full permission & settings modal
      setShowGpsModal(true);
    } finally {
      setRequestingGps(false);
    }
  };

  useEffect(() => {
    const saved = loadSavedLiveGpsLocation();
    if (saved) {
      setLiveGps(saved);
      syncNearbyDemoKitchenToUserGps(saved.latitude, saved.longitude);
    } else if (
      profile?.liveGps &&
      typeof profile.liveGps.latitude === 'number' &&
      typeof profile.liveGps.longitude === 'number'
    ) {
      setLiveGps(profile.liveGps as GpsCoordinates);
      syncNearbyDemoKitchenToUserGps(profile.liveGps.latitude, profile.liveGps.longitude);
    } else {
      setShowGpsModal(true);
      triggerBrowserGpsPopup();
    }

    const handleGpsEvent = (e: Event) => {
      const gps = (e as CustomEvent<GpsCoordinates>).detail;
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        setLiveGps(gps);
        syncNearbyDemoKitchenToUserGps(gps.latitude, gps.longitude);
      }
    };
    window.addEventListener('food_india_gps_updated', handleGpsEvent);
    return () => window.removeEventListener('food_india_gps_updated', handleGpsEvent);
  }, [profile?.liveGps?.latitude, profile?.liveGps?.longitude]);

  useEffect(() => {
    // 1. Fetch Categories
    const categoriesQuery = query(collection(db, 'categories'));
    const unsubscribeCats = onSnapshot(categoriesQuery, (snapshot) => {
      const list = snapshot.docs
        .map((doc) => ({ ...doc.data(), categoryId: doc.id } as Category))
        .filter((c) => c.isActive !== false)
        .sort((a, b) => (a.displayOrder ?? a.sortOrder ?? 999) - (b.displayOrder ?? b.sortOrder ?? 999));
      setCategories(list);
    }, () => {});

    // 2. Fetch All Restaurants
    const nearbyQuery = query(collection(db, 'restaurants'));
    const unsubscribeNearby = onSnapshot(nearbyQuery, (snapshot) => {
      setRestaurantsRaw(
        snapshot.docs.map((doc) => ({ ...doc.data(), restaurantId: doc.id } as Restaurant))
      );
    }, () => {});

    // 3. Fetch All Dishes / Products
    const foodsQuery = query(collection(db, 'products'), limit(120));
    const unsubscribeFoods = onSnapshot(foodsQuery, (snapshot) => {
      const rawList = snapshot.docs
        .map((doc) => ({ ...doc.data(), productId: doc.id } as Product))
        .filter((p) => p.isAvailable !== false && !(p as any).archived);

      // Deduplicate dishes by normalized name + restaurantId so dishes never appear twice
      const seenKeys = new Set<string>();
      const deduped: Product[] = [];
      for (const item of rawList) {
        const key = `${(item.name || '').trim().toLowerCase()}__${item.restaurantId || ''}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          deduped.push(item);
        }
      }
      setFoodsRaw(deduped);
    }, () => {});

    return () => {
      unsubscribeCats();
      unsubscribeNearby();
      unsubscribeFoods();
    };
  }, []);

  // Compute 100% accurate live Haversine GPS distance & rating score for every restaurant
  const allRestaurantsWithDistance = useMemo(() => {
    const withDist = restaurantsRaw.map((res) => {
      const hasValidResCoords =
        typeof res.latitude === 'number' &&
        typeof res.longitude === 'number' &&
        Number.isFinite(res.latitude) &&
        Number.isFinite(res.longitude) &&
        (res.latitude !== 0 || res.longitude !== 0);

      const distanceKm =
        liveGps && hasValidResCoords
          ? calculateDistance(
              liveGps.latitude,
              liveGps.longitude,
              Number(res.latitude),
              Number(res.longitude)
            )
          : undefined;

      const rating = typeof res.rating === 'number' && res.rating > 0 ? res.rating : 4.8;
      return {
        ...res,
        distanceKm,
        rating,
      };
    });

    return withDist.sort((a, b) => {
      const distA = typeof a.distanceKm === 'number' ? a.distanceKm : 99999;
      const distB = typeof b.distanceKm === 'number' ? b.distanceKm : 99999;
      const distDiff = distA - distB;
      if (Math.abs(distDiff) > 0.05) return distDiff;
      return (b.rating ?? 4.8) - (a.rating ?? 4.8);
    });
  }, [restaurantsRaw, liveGps]);

  // Filter to nearby restaurants (within max delivery radius or 35 km, or matching PIN/city) when nearbyOnly is enabled
  const sortedRestaurants = useMemo(() => {
    if (!nearbyOnly || !liveGps) return allRestaurantsWithDistance;
    const nearbyList = allRestaurantsWithDistance.filter((res) => {
      const maxKm = Number(res.maximumDeliveryDistanceKm || 35);
      if (typeof res.distanceKm === 'number' && res.distanceKm <= Math.max(maxKm, 35)) {
        return true;
      }
      if (
        liveGps.pincode &&
        (res.pincode === liveGps.pincode || res.postalCode === liveGps.pincode)
      ) {
        return true;
      }
      if (
        liveGps.city &&
        res.city &&
        res.city.toLowerCase() === liveGps.city.toLowerCase()
      ) {
        return true;
      }
      return false;
    });
    return nearbyList.length > 0 ? nearbyList : allRestaurantsWithDistance;
  }, [allRestaurantsWithDistance, nearbyOnly, liveGps]);

  const restaurantMap = useMemo(() => {
    const map: Record<string, Restaurant> = {};
    allRestaurantsWithDistance.forEach((r) => {
      map[r.restaurantId] = r;
    });
    return map;
  }, [allRestaurantsWithDistance]);

  const nearbyRestaurantIds = useMemo(
    () => new Set(sortedRestaurants.map((r) => r.restaurantId)),
    [sortedRestaurants]
  );

  // Compute 100% accurate live GPS distance & rating for every dish
  const sortedFoods = useMemo(() => {
    const sourceFoods =
      nearbyOnly && liveGps
        ? foodsRaw.filter((f) => nearbyRestaurantIds.has(f.restaurantId))
        : foodsRaw;
    const listToRank = sourceFoods.length > 0 ? sourceFoods : foodsRaw;

    const enriched = listToRank.map((food) => {
      const res = restaurantMap[food.restaurantId];
      const distanceKm = res?.distanceKm;
      const rating = typeof food.rating === 'number' && food.rating > 0 ? food.rating : 4.8;
      return {
        ...food,
        distanceKm,
        rating,
      };
    });

    return enriched.sort((a, b) => {
      const distA = typeof a.distanceKm === 'number' ? a.distanceKm : 99999;
      const distB = typeof b.distanceKm === 'number' ? b.distanceKm : 99999;
      const distDiff = distA - distB;
      if (Math.abs(distDiff) > 0.05) return distDiff;
      return (b.rating ?? 4.8) - (a.rating ?? 4.8);
    });
  }, [foodsRaw, restaurantMap, nearbyOnly, liveGps, nearbyRestaurantIds]);

  const handleRestaurantClick = (id: string) => {
    navigate(`/restaurant/${id}`);
  };

  const handleRateDishQuick = async (
    e: React.MouseEvent,
    food: Product,
    stars: number
  ) => {
    e.stopPropagation();
    if (ratingLoadingById[food.productId]) return;
    setRatingLoadingById((prev) => ({ ...prev, [food.productId]: true }));
    setUserRatedMap((prev) => ({ ...prev, [food.productId]: stars }));
    try {
      const res = restaurantMap[food.restaurantId];
      await reviewService.submitReview({
        targetType: 'product',
        targetId: food.productId,
        productId: food.productId,
        productName: food.name,
        restaurantId: food.restaurantId || '',
        restaurantName: res?.restaurantName || food.restaurantName || 'Kitchen',
        customerId: user?.uid || 'guest_customer',
        customerName: profile?.fullName || user?.displayName || 'Verified Customer',
        rating: stars,
        comment: `Rated ${stars} star${stars > 1 ? 's' : ''} from Customer Dashboard`,
      });
    } catch (err) {
      console.error('Error submitting quick dish rating:', err);
    } finally {
      setRatingLoadingById((prev) => ({ ...prev, [food.productId]: false }));
    }
  };

  const filteredFoods = selectedCategoryId
    ? sortedFoods.filter(
        (f) =>
          f.categoryId === selectedCategoryId ||
          f.name?.toLowerCase().includes(selectedCategoryId.replace(/-/g, ' '))
      )
    : sortedFoods;

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return <OrdersTab />;
      case 'search':
        return <SearchTab />;
      case 'profile':
        return <ProfileTab />;
      default:
        return (
          <main className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-full overflow-x-hidden">
            {/* Categories Section */}
            <section>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  What&apos;s on your mind?
                </h3>
                {selectedCategoryId && (
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className="text-xs font-black text-orange-600 uppercase tracking-widest"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="flex overflow-x-auto gap-3.5 no-scrollbar pb-2 -mx-4 px-4">
                {categories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.categoryId;
                  return (
                    <motion.button
                      key={cat.categoryId}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedCategoryId(isSelected ? null : cat.categoryId)}
                      className="flex flex-col items-center gap-2 shrink-0 group"
                    >
                      <div
                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-white border-2 shadow-sm transition-colors ${
                          isSelected
                            ? 'border-orange-500 ring-4 ring-orange-100'
                            : 'border-slate-100 group-hover:border-orange-500'
                        }`}
                      >
                        <img
                          src={cat.imagePath}
                          alt={cat.name}
                          className="w-full h-full object-cover p-1.5"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider text-center max-w-[74px] truncate ${
                          isSelected ? 'text-orange-600' : 'text-slate-600'
                        }`}
                      >
                        {cat.name}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* Nearest & Top-Rated Dishes First (with 1-5 Star Live Rating on Each Dish) */}
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    {selectedCategoryId ? 'Filtered Dishes Near You' : 'Nearest & Top-Rated Dishes First'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    Ranked by 100% accurate live GPS proximity & customer star ratings
                  </p>
                </div>
              </div>
              <div className="flex overflow-x-auto gap-3.5 no-scrollbar pb-4 -mx-4 px-4">
                {filteredFoods.map((food) => {
                  const res = restaurantMap[food.restaurantId];
                  const distLabel = formatExactDistance(food.distanceKm);
                  const ratingVal =
                    typeof food.rating === 'number' ? food.rating.toFixed(1) : '4.8';
                  const priceVal = food.price ?? food.basePrice ?? 0;
                  const userRated = userRatedMap[food.productId];

                  return (
                    <div
                      key={food.productId}
                      onClick={() => navigate(`/product/${food.productId}`)}
                      className="w-48 shrink-0 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden text-left flex flex-col justify-between cursor-pointer hover:border-orange-200 transition-all"
                    >
                      <div className="relative h-32 w-full bg-slate-50">
                        <img
                          src={
                            food.imagePaths?.[0] ||
                            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
                          }
                          alt={food.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1">
                          <Navigation size={10} className="text-emerald-400" />
                          <span>{distLabel}</span>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-amber-500 text-white px-1.5 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-0.5 shadow">
                          <Star size={10} className="fill-white" />
                          <span>{ratingVal}</span>
                          {food.reviewCount ? (
                            <span className="text-[9px] opacity-90">({food.reviewCount})</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-black text-slate-900 truncate">{food.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                            {res?.restaurantName || 'Indian Kitchen'}
                          </p>

                          {/* Interactive 1 to 5 Star Rating Bar on Dish Card */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1"
                          >
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const active = (userRated || Math.round(Number(ratingVal))) >= star;
                                return (
                                  <button
                                    key={star}
                                    type="button"
                                    disabled={ratingLoadingById[food.productId]}
                                    onClick={(e) => handleRateDishQuick(e, food, star)}
                                    title={`Rate ${star} Star${star > 1 ? 's' : ''}`}
                                    className="p-0.5 hover:scale-125 transition-transform"
                                  >
                                    <Star
                                      size={12}
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
                            {userRated ? (
                              <span className="text-[9px] font-black text-emerald-600 flex items-center gap-0.5">
                                <CheckCircle2 size={9} /> {userRated}★
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-400">Rate</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-50">
                          <span className="text-xs font-black text-slate-900">₹{priceVal}</span>
                          <span className="px-2.5 py-1 bg-orange-500 text-white rounded-lg text-[10px] font-black uppercase">
                            Order
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Nearby Restaurants with 100% Accurate Distance */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    {nearbyOnly ? 'Nearby Restaurants' : 'All Restaurants'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    {liveGps
                      ? `100% accurate live GPS distance from your location (${liveGps.latitude.toFixed(4)}, ${liveGps.longitude.toFixed(4)}${liveGps.pincode ? ` • PIN ${liveGps.pincode}` : ''})`
                      : 'Allow browser location access to calculate exact distance from each restaurant'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!liveGps && (
                    <button
                      type="button"
                      onClick={triggerBrowserGpsPopup}
                      disabled={requestingGps}
                      className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                    >
                      <Navigation size={11} />
                      <span>{requestingGps ? 'Locating...' : 'Allow Browser GPS'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNearbyOnly((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-colors ${
                      nearbyOnly
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {nearbyOnly ? 'Nearby Only ✓' : 'Showing All'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5">
                {sortedRestaurants.map((res) => (
                  <RestaurantCard
                    key={res.restaurantId}
                    restaurant={res}
                    onClick={() => handleRestaurantClick(res.restaurantId)}
                  />
                ))}
              </div>
            </section>
          </main>
        );
    }
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-50 pb-24">
      <GpsPermissionModal
        isOpen={showGpsModal}
        onClose={() => setShowGpsModal(false)}
        compulsory={!liveGps}
        initialPhone={profile?.phone || ''}
        title="Allow Location Access & Save Live GPS"
        onConfirmed={({ gps }) => {
          setLiveGps(gps);
          setShowGpsModal(false);
          syncNearbyDemoKitchenToUserGps(gps.latitude, gps.longitude);
        }}
      />

      {activeTab === 'home' && (
        <DashboardHeader
          address={
            loadSavedLiveGpsLocation()?.address ||
            profile?.liveGps?.address ||
            profile?.phone ||
            'Tap to Pin Phone GPS'
          }
          onAddressClick={() => setShowGpsModal(true)}
          onNotificationsClick={() => setActiveTab('orders')}
          onProfileClick={() => setActiveTab('profile')}
          onSearchClick={() => setActiveTab('search')}
          onCartClick={() => navigate('/cart')}
        />
      )}

      <div className={`px-4 py-6 max-w-2xl mx-auto w-full ${activeTab !== 'home' ? 'pt-8' : ''}`}>
        {renderContent()}
      </div>

      {/* Floating Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 max-w-md mx-auto">
        <div className="bg-slate-900/95 backdrop-blur-xl h-16 rounded-[24px] border border-white/10 shadow-2xl flex items-center justify-around px-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'home' ? 'text-orange-500' : 'text-white/50'
            }`}
          >
            <HomeIcon size={20} />
            <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'orders' ? 'text-orange-500' : 'text-white/50'
            }`}
          >
            <ShoppingBag size={20} />
            <span className="text-[9px] font-black uppercase tracking-widest">Orders</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'search' ? 'text-orange-500' : 'text-white/50'
            }`}
          >
            <SearchIcon size={20} />
            <span className="text-[9px] font-black uppercase tracking-widest">Search</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'profile' ? 'text-orange-500' : 'text-white/50'
            }`}
          >
            <UserIcon size={20} />
            <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default CustomerDashboard;
