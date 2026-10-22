import React, { useState, useEffect } from 'react';
import { Search, X, History, TrendingUp, ChevronRight, Store, Utensils } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Product, Restaurant } from '../models/types';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/helpers';

const SearchTab: React.FC = () => {
  const navigate = useNavigate();
  const [queryText, setQueryText] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  const recentSearches = ['Biryani', 'Paneer', 'Burger', 'Pizza', 'Thali', 'Masala Dosa'];
  const popularCuisines = ['North Indian', 'South Indian', 'Biryani', 'Street Food', 'Desserts'];

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ ...d.data(), productId: d.id } as Product)));
    }, () => {});
    const unsubRestaurants = onSnapshot(collection(db, 'restaurants'), (snap) => {
      setRestaurants(snap.docs.map(d => ({ ...d.data(), restaurantId: d.id } as Restaurant)));
    }, () => {});
    return () => {
      unsubProducts();
      unsubRestaurants();
    };
  }, []);

  const normalizedQuery = queryText.trim().toLowerCase();
  const matchingRestaurants = normalizedQuery
    ? restaurants.filter(r =>
        r.restaurantName?.toLowerCase().includes(normalizedQuery) ||
        r.address?.toLowerCase().includes(normalizedQuery) ||
        r.cuisineTypes?.some(c => c.toLowerCase().includes(normalizedQuery))
      )
    : [];

  const matchingProducts = normalizedQuery
    ? products.filter(p =>
        p.isAvailable !== false && (
          p.name?.toLowerCase().includes(normalizedQuery) ||
          p.description?.toLowerCase().includes(normalizedQuery) ||
          p.categoryId?.toLowerCase().includes(normalizedQuery)
        )
      )
    : [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors">
          <Search size={22} strokeWidth={3} />
        </div>
        <input 
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search for dishes or restaurants..."
          className="w-full h-16 pl-14 pr-12 bg-white border border-slate-100 rounded-[24px] shadow-lg shadow-slate-200/50 focus:outline-none focus:border-orange-500 font-bold text-slate-900 transition-all placeholder:text-slate-300"
        />
        {queryText && (
          <button 
            onClick={() => setQueryText('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
          >
            <X size={16} strokeWidth={3} />
          </button>
        )}
      </div>

      {!normalizedQuery ? (
        <>
          {/* Recent Searches */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-400">
              <History size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Quick Searches</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <button 
                  key={s}
                  onClick={() => setQueryText(s)}
                  className="px-5 py-2.5 bg-white border border-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:border-orange-500 hover:text-orange-600 transition-all active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* Popular Cuisines */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-slate-400">
              <TrendingUp size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Popular Cuisines</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {popularCuisines.map((c) => (
                <button 
                  key={c}
                  onClick={() => setQueryText(c)}
                  className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl group hover:border-orange-500 transition-all"
                >
                  <span className="font-bold text-slate-900">{c}</span>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="space-y-6">
          {/* Matching Restaurants */}
          {matchingRestaurants.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Store size={14} /> Restaurants ({matchingRestaurants.length})
              </h3>
              <div className="space-y-3">
                {matchingRestaurants.map(res => (
                  <button
                    key={res.restaurantId}
                    onClick={() => navigate(`/restaurant/${res.restaurantId}`)}
                    className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-orange-500 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={res.logoPath || res.bannerPath || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120&h=120&fit=crop'}
                        alt={res.restaurantName}
                        className="w-12 h-12 rounded-xl object-cover bg-slate-100"
                      />
                      <div>
                        <h4 className="font-black text-slate-900">{res.restaurantName}</h4>
                        <p className="text-xs text-slate-400 truncate max-w-[220px]">{res.address}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Matching Dishes */}
          {matchingProducts.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Utensils size={14} /> Dishes ({matchingProducts.length})
              </h3>
              <div className="space-y-3">
                {matchingProducts.map(prod => (
                  <button
                    key={prod.productId}
                    onClick={() => navigate(`/product/${prod.productId}`)}
                    className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-orange-500 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={prod.imagePaths?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=120&h=120&fit=crop'}
                        alt={prod.name}
                        className="w-14 h-14 rounded-xl object-cover bg-slate-100"
                      />
                      <div>
                        <h4 className="font-black text-slate-900">{prod.name}</h4>
                        <p className="text-xs font-bold text-orange-600">{formatCurrency(prod.price)}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {matchingRestaurants.length === 0 && matchingProducts.length === 0 && (
            <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-slate-100">
              <Search size={32} className="mx-auto text-slate-300" />
              <p className="text-slate-500 font-bold">No dishes or restaurants found for "{queryText}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchTab;

