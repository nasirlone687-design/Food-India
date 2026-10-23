import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PluginRestaurant, PluginDeliveryPartner } from '../models/types';
import { Navigation } from 'lucide-react';

interface LeafletMapContainerProps {
  restaurants: PluginRestaurant[];
  selectedRestaurant: PluginRestaurant | null;
  onSelectRestaurant: (restaurant: PluginRestaurant) => void;
  deliveryPartners?: PluginDeliveryPartner[];
  selectedPartner?: PluginDeliveryPartner | null;
  onSelectPartner?: (partner: PluginDeliveryPartner) => void;
  userLocation: { lat: number; lng: number } | null;
  onRequestLocation: () => void;
  isLocating?: boolean;
}

export const LeafletMapContainer: React.FC<LeafletMapContainerProps> = ({
  restaurants,
  selectedRestaurant,
  onSelectRestaurant,
  deliveryPartners = [],
  selectedPartner,
  onSelectPartner,
  userLocation,
  onRequestLocation,
  isLocating = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const restaurantMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const partnerMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Leaflet Map instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [33.7297, 75.1498]; // Default region

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: false,
    });

    // Add OpenStreetMap Free Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync user location marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    const userLatLng: [number, number] = [userLocation.lat, userLocation.lng];

    if (!userMarkerRef.current) {
      const userIcon = L.divIcon({
        className: 'custom-user-pin',
        html: `
          <div class="relative flex flex-col items-center justify-center">
            <span class="absolute inline-flex h-10 w-10 rounded-full bg-blue-500/40 animate-ping"></span>
            <div class="relative w-9 h-9 bg-blue-600 border-2 border-white rounded-full shadow-xl flex items-center justify-center text-white font-bold text-sm">
              <span class="text-base leading-none">🧍</span>
            </div>
            <div class="px-2 py-0.5 bg-blue-900 text-white text-[9px] font-black rounded-md shadow-md mt-0.5 whitespace-nowrap border border-blue-400">
              🧍 You Are Here
            </div>
          </div>
        `,
        iconSize: [80, 55],
        iconAnchor: [40, 40],
      });

      const marker = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindTooltip('Your Live Location 🧍', { permanent: false, direction: 'top' });

      userMarkerRef.current = marker;
      map.flyTo(userLatLng, 15);
    } else {
      userMarkerRef.current.setLatLng(userLatLng);
      map.flyTo(userLatLng, 15);
    }
  }, [userLocation]);

  // Sync restaurant markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    restaurantMarkersRef.current.forEach((m) => m.remove());
    restaurantMarkersRef.current.clear();

    restaurants.forEach((res) => {
      if (typeof res.latitude !== 'number' || typeof res.longitude !== 'number') return;

      const isSelected = selectedRestaurant?.restaurantId === res.restaurantId;
      const isOpen = res.isOpen ?? true;

      const markerIcon = L.divIcon({
        className: 'custom-restaurant-pin',
        html: `
          <div class="cursor-pointer group flex flex-col items-center transition-transform ${
            isSelected ? 'scale-125 z-50' : 'hover:scale-110'
          }">
            <div class="px-2 py-0.5 bg-slate-900 text-white rounded-md text-[10px] font-black shadow-md whitespace-nowrap flex items-center gap-1 mb-0.5 border border-slate-700">
              <span>🍲 ${res.name}</span>
              <span class="text-amber-400 font-bold">★ ${res.rating || 4.8}</span>
            </div>
            <div class="w-10 h-10 rounded-full ${
              isOpen ? 'bg-orange-500 border-2 border-white' : 'bg-slate-600 border-2 border-slate-200'
            } shadow-xl flex items-center justify-center text-white relative">
              ${
                res.logoUrl
                  ? `<img src="${res.logoUrl}" class="w-full h-full object-cover rounded-full" />`
                  : `<span class="text-lg">🍽️</span>`
              }
              <div class="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full border border-white flex items-center justify-center text-[10px] shadow">
                🍔
              </div>
              <span class="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full ${
                isOpen ? 'bg-emerald-500 border-2 border-white' : 'bg-red-500 border-2 border-white'
              }"></span>
            </div>
            <div class="w-2.5 h-2.5 bg-orange-600 rotate-45 -mt-1 shadow-sm"></div>
          </div>
        `,
        iconSize: [130, 55],
        iconAnchor: [65, 52],
      });

      const marker = L.marker([res.latitude, res.longitude], { icon: markerIcon }).addTo(map);

      marker.on('click', () => {
        onSelectRestaurant(res);
        map.panTo([res.latitude, res.longitude]);
      });

      restaurantMarkersRef.current.set(res.restaurantId, marker);
    });
  }, [restaurants, selectedRestaurant, onSelectRestaurant]);

  // Sync delivery partner vehicle markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    partnerMarkersRef.current.forEach((m) => m.remove());
    partnerMarkersRef.current.clear();

    deliveryPartners.forEach((partner) => {
      if (typeof partner.latitude !== 'number' || typeof partner.longitude !== 'number') return;

      const isSelected = selectedPartner?.partnerId === partner.partnerId;
      const vehicleEmoji =
        partner.vehicleType === 'bike'
          ? '🏍️'
          : partner.vehicleType === 'auto'
          ? '🛺'
          : partner.vehicleType === 'van'
          ? '🚚'
          : '🛵';

      const partnerIcon = L.divIcon({
        className: 'custom-partner-pin',
        html: `
          <div class="cursor-pointer group flex flex-col items-center transition-transform ${
            isSelected ? 'scale-125 z-50' : 'hover:scale-110'
          }">
            <div class="px-2 py-0.5 bg-emerald-900 text-emerald-100 rounded-md text-[10px] font-black shadow-md whitespace-nowrap flex items-center gap-1 mb-0.5 border border-emerald-500">
              <span>${vehicleEmoji} ${partner.name.split(' ')[0]}</span>
              <span class="text-amber-300 font-bold">₹${partner.pricePerKm}/km</span>
            </div>
            <div class="w-9 h-9 rounded-full bg-emerald-600 border-2 border-white shadow-2xl flex items-center justify-center text-white text-base relative">
              <span>${vehicleEmoji}</span>
              <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white"></span>
            </div>
            <div class="w-2 h-2 bg-emerald-700 rotate-45 -mt-1"></div>
          </div>
        `,
        iconSize: [120, 50],
        iconAnchor: [60, 48],
      });

      const marker = L.marker([partner.latitude, partner.longitude], {
        icon: partnerIcon,
        zIndexOffset: 900,
      }).addTo(map);

      marker.on('click', () => {
        if (onSelectPartner) {
          onSelectPartner(partner);
        }
        map.panTo([partner.latitude, partner.longitude]);
      });

      partnerMarkersRef.current.set(partner.partnerId, marker);
    });
  }, [deliveryPartners, selectedPartner, onSelectPartner]);

  // Pan to selected restaurant
  useEffect(() => {
    if (selectedRestaurant && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([selectedRestaurant.latitude, selectedRestaurant.longitude]);
    }
  }, [selectedRestaurant]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Locate Me Floating Arrow Button */}
      <div className="absolute bottom-20 right-4 sm:bottom-24 sm:right-6 z-20 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={onRequestLocation}
          disabled={isLocating}
          className="group px-4 py-3 bg-white hover:bg-orange-50 text-orange-600 rounded-2xl shadow-2xl border border-slate-200 active:scale-95 transition-all flex items-center gap-2 font-black text-xs disabled:opacity-50"
          title="Detect and Pick My Live Location"
        >
          <Navigation
            className={`w-5 h-5 fill-orange-500 text-orange-600 ${
              isLocating ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'
            }`}
          />
          <span className="hidden sm:inline uppercase tracking-wider">Locate Me</span>
        </button>
      </div>

      {/* Attribution overlay badge */}
      <div className="absolute bottom-2 left-2 z-10 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[9px] font-bold text-slate-600 border border-slate-200 shadow-sm flex items-center gap-1.5 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Leaflet OpenStreetMap • Registered Kitchens & Live Vehicle Partners</span>
      </div>
    </div>
  );
};

